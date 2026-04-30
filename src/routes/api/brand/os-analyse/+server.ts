import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import Anthropic from '@anthropic-ai/sdk';

/** Strip markdown code fences from LLM output before JSON.parse */
function extractJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return s;
}

/**
 * Phased brand analysis — runs one LLM phase at a time and updates
 * the brand_snapshots.intelligence JSONB column progressively.
 *
 * POST /api/brand/os-analyse
 * Body: { phase: "audience" | "strategy" | "brief" | "all" }
 *
 * Each phase reads existing data from the snapshot and adds to it.
 */

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const body = await request.json().catch(() => ({}));
  const phase = String(body?.phase || 'all');

  const sb = getServiceSupabase();

  // Get current snapshot + brand info
  const [snapRes, brandRes] = await Promise.all([
    sb.from('brand_snapshots')
      .select('id,intelligence,engagement_rate,reach_7d,avg_saves,avg_shares,posts_per_week,snapshot_date')
      .eq('brand_ig_id', igUserId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('brand_accounts')
      .select('ig_name,ig_username,ig_followers_count,ig_access_token')
      .eq('ig_user_id', igUserId)
      .maybeSingle(),
  ]);

  if (!snapRes.data) return json({ ok: false, error: 'No snapshot found. Run initial data sync first.' }, { status: 400 });
  if (!brandRes.data) return json({ ok: false, error: 'Brand account not found.' }, { status: 404 });

  const snapshot = snapRes.data;
  const brand = brandRes.data;
  const intel = (snapshot.intelligence as Record<string, any>) || {};
  const identity = intel.identity || {};
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const results: string[] = [];

  try {
    // ── Phase: Audience Portrait ──
    if (phase === 'audience' || phase === 'all') {
      console.log(`[os-analyse] Running audience portrait for ${igUserId}`);
      const audiencePrompt = `You are analysing the Instagram audience for ${brand.ig_name} (@${brand.ig_username}).

Brand identity: ${identity.rawSummary || 'Event-tech platform for nightlife and community'}
Interests: ${(identity.interests || []).join(', ')}
Followers: ${brand.ig_followers_count}
Engagement rate: ${snapshot.engagement_rate}%
City: ${identity.city || 'Unknown'}

Based on this brand's positioning and content, write a vivid audience portrait. Be specific and conversational — describe real people, not demographics.

Respond with ONLY valid JSON:
{
  "narrative": "2-3 conversational sentences describing who follows this brand and why",
  "primaryDemographic": { "ageRange": "e.g. 22-35", "gender": "e.g. Mixed, slight male lean", "topCities": ["city1", "city2"], "topCountries": ["country1"] },
  "personas": [
    { "name": "persona name", "description": "1 sentence description" },
    { "name": "persona name", "description": "1 sentence description" }
  ]
}`;

      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: audiencePrompt }],
      });

      const text = res.content[0].type === 'text' ? res.content[0].text : '';
      const parsed = JSON.parse(extractJson(text));
      intel.audiencePortrait = parsed;
      results.push('audience');
    }

    // ── Phase: Strategic Positioning ──
    if (phase === 'strategy' || phase === 'all') {
      console.log(`[os-analyse] Running strategic positioning for ${igUserId}`);
      const audience = intel.audiencePortrait || {};
      const brandScheme = intel.brandScheme as Record<string, any> | undefined;
      const websiteContext = brandScheme?.sourceUrl
        ? `Website: ${brandScheme.sourceUrl}${brandScheme.tagline ? ` — "${brandScheme.tagline}"` : ''}`
        : '';

      const stratPrompt = `You are a brand strategist analysing ${brand.ig_name} (@${brand.ig_username}).

Brand identity: ${identity.rawSummary || 'N/A'}
Aesthetic: ${identity.aesthetic || 'N/A'}
Interests: ${(identity.interests || []).join(', ')}
${websiteContext}
Audience: ${audience.narrative || 'Not yet analysed'}
Followers: ${brand.ig_followers_count}, Engagement: ${snapshot.engagement_rate}%
Reach (7d): ${snapshot.reach_7d}, Saves: ${snapshot.avg_saves}/post, Shares: ${snapshot.avg_shares}/post
Posts/week: ${snapshot.posts_per_week}
Top hashtags: ${(intel.topHashtags || []).slice(0, 8).map((h: any) => h.tag || h).join(', ')}

Write a strategic brand direction. Be specific, bold, and conversational — like advising a founder you know well.

For contentPillars: create 3-4 named content pillars that are specific to THIS brand (e.g. "Behind the Build", "Community Spotlight", "Founder POV") — NOT generic categories like "Education" or "Proof".

For quickWins: give 5 highly specific, vivid content ideas. Each should be a concrete post idea the brand could create THIS WEEK — mention the format (carousel, reel, static), specific angles, and why it would resonate with their audience. Reference actual aspects of the brand, not generic marketing advice.

Respond with ONLY valid JSON:
{
  "brandDirection": "2-3 sentences — the core strategic narrative for this brand",
  "contentPillars": ["pillar1", "pillar2", "pillar3", "pillar4"],
  "voiceGuidelines": "1-2 sentences on tone and voice",
  "competitiveGaps": "1-2 sentences on what competitors miss that this brand can own",
  "bigBet": "1 sentence — the one bold move this brand should make",
  "quickWins": ["vivid content idea 1", "vivid content idea 2", "vivid content idea 3", "vivid content idea 4", "vivid content idea 5"]
}`;

      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: stratPrompt }],
      });

      const text = res.content[0].type === 'text' ? res.content[0].text : '';
      const parsed = JSON.parse(extractJson(text));
      intel.strategicPositioning = parsed;
      results.push('strategy');
    }

    // ── Save updated intelligence to snapshot ──
    if (results.length > 0) {
      await sb.from('brand_snapshots')
        .update({ intelligence: intel })
        .eq('id', snapshot.id);
    }

    // ── Phase: Brief (runs generateDailyBrief which uses Claude) ──
    if (phase === 'brief' || phase === 'all') {
      console.log(`[os-analyse] Running daily brief for ${igUserId}`);
      const { generateDailyBrief } = await import('$lib/server/brand/brandOsEngine');
      await generateDailyBrief(igUserId);
      results.push('brief');
    }

    return json({ ok: true, phases: results, message: `Completed: ${results.join(', ')}` });
  } catch (err) {
    console.error('[os-analyse] Error:', err);
    // Still save partial results if we got any
    if (results.length > 0) {
      await sb.from('brand_snapshots')
        .update({ intelligence: intel })
        .eq('id', snapshot.id)
        .then(() => {});
    }
    return json({
      ok: false,
      phases: results,
      error: err instanceof Error ? err.message : 'Analysis failed',
    }, { status: 500 });
  }
};
