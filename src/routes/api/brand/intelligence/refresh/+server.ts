export const config = { maxDuration: 60 };

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

/**
 * Multi-phase refresh. Each phase completes in <10s (Vercel Hobby safe).
 * Client calls: phase=1 → phase=2a → phase=2b → phase=2c → phase=2d
 */
export const POST: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const phase = url.searchParams.get('phase') || '1';
  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const anthropicKey = env.ANTHROPIC_API_KEY!;
  const h = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };
  const esc = encodeURIComponent(igUserId);

  // Get brand
  const brandRes = await fetch(`${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${esc}&select=ig_access_token,ig_username,ig_name,ig_followers_count,brand_identity&limit=1`, { headers: h });
  const brands = await brandRes.json();
  if (!brands.length) throw error(404, 'Brand not found');
  const brand = brands[0];
  const token = brand.ig_access_token;

  try {
    // ════════════════════════════════════════════════════
    // PHASE 1: Instagram data + metrics (~5-8s)
    // ════════════════════════════════════════════════════
    if (phase === '1') {
      // Verify token
      const testRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=id&access_token=${token}`);
      if (!testRes.ok) return json({ ok: false, error: 'Instagram token expired. Please re-authenticate.', needsReauth: true }, { status: 401 });

      const { fetchInstagramProfile, fetchInstagramMedia } = await import('$lib/server/instagram');
      const { computePostingHeatmap, computeHashtags, computeFormatBreakdown, computeGrowthTrend, fetchPostInsights, fetchAccountInsights } = await import('$lib/server/brandIntelligence');

      const [profile, media] = await Promise.all([
        fetchInstagramProfile(token),
        fetchInstagramMedia(token, 25),
      ]);

      const [accountInsights, postInsights] = await Promise.all([
        fetchAccountInsights(igUserId, token),
        fetchPostInsights(media, token),
      ]);

      const { heatmap, bestHours, bestDays } = computePostingHeatmap(postInsights);
      const topHashtags = computeHashtags(media);
      const formatBreakdown = computeFormatBreakdown(postInsights);
      const growthTrend = computeGrowthTrend(postInsights);
      const totalEng = postInsights.reduce((s, p) => s + p.engagement, 0);
      const engagementRate = profile.followers_count ? +((totalEng / postInsights.length) / profile.followers_count * 100).toFixed(2) : 0;
      let postsPerWeek = 0;
      if (media.length >= 2) {
        const daySpan = (new Date(media[0].timestamp).getTime() - new Date(media[media.length - 1].timestamp).getTime()) / 86400000;
        postsPerWeek = daySpan > 0 ? Math.round((media.length / daySpan) * 7 * 10) / 10 : 0;
      }

      const today = new Date().toISOString().split('T')[0];
      await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?on_conflict=brand_ig_id,snapshot_date`, {
        method: 'POST',
        headers: { ...h, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          brand_ig_id: igUserId, snapshot_date: today,
          followers: profile.followers_count || 0, following: 0, media_count: profile.media_count || 0,
          impressions_7d: accountInsights.impressions7d, reach_7d: accountInsights.reach7d, profile_views_7d: accountInsights.profileViews7d,
          engagement_rate: engagementRate,
          avg_likes: postInsights.length ? postInsights.reduce((s, p) => s + p.likes, 0) / postInsights.length : 0,
          avg_comments: postInsights.length ? postInsights.reduce((s, p) => s + p.comments, 0) / postInsights.length : 0,
          avg_saves: postInsights.length ? postInsights.reduce((s, p) => s + p.saved, 0) / postInsights.length : 0,
          avg_shares: postInsights.length ? postInsights.reduce((s, p) => s + p.shares, 0) / postInsights.length : 0,
          avg_reach: postInsights.length ? postInsights.reduce((s, p) => s + p.reach, 0) / postInsights.length : 0,
          posts_per_week: postsPerWeek, demographics: {}, content_performance: { formatBreakdown },
          intelligence: {
            identity: brand.brand_identity || {},
            postingHeatmap: heatmap, bestHours, bestDays, topHashtags,
            recentPosts: media.slice(0, 12).map(m => ({
              id: m.id,
              thumbnail: m.thumbnail_url || m.media_url || '',
              type: m.media_type,
              likes: m.like_count || 0,
              comments: m.comments_count || 0,
              permalink: m.permalink || '',
            })),
          },
        }),
      });

      await fetch(`${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${esc}`, {
        method: 'PATCH', headers: h,
        body: JSON.stringify({ ig_followers_count: profile.followers_count || 0 }),
      });

      return json({ ok: true, phase: 1, message: 'Metrics updated' });
    }

    // ════════════════════════════════════════════════════
    // PHASE 2a: Identity pipeline (~8s)
    // ════════════════════════════════════════════════════
    if (phase === '2a') {
      const { fetchInstagramProfile, fetchInstagramMedia, analyseInstagramIdentity } = await import('$lib/server/instagram');
      const [profile, media] = await Promise.all([
        fetchInstagramProfile(token),
        fetchInstagramMedia(token, 20),
      ]);
      const identity = await analyseInstagramIdentity(profile, media, token);

      // Store identity
      await fetch(`${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${esc}`, {
        method: 'PATCH', headers: h,
        body: JSON.stringify({ brand_identity: identity, identity_updated_at: new Date().toISOString() }),
      });

      // Update snapshot intelligence
      const today = new Date().toISOString().split('T')[0];
      const snapRes = await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${esc}&snapshot_date=eq.${today}&select=intelligence`, { headers: h });
      const snaps = snapRes.ok ? await snapRes.json() : [];
      if (snaps[0]) {
        const intel = snaps[0].intelligence || {};
        intel.identity = identity;
        await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${esc}&snapshot_date=eq.${today}`, {
          method: 'PATCH', headers: h, body: JSON.stringify({ intelligence: intel }),
        });
      }

      return json({ ok: true, phase: '2a', message: 'Identity extracted' });
    }

    // ════════════════════════════════════════════════════
    // PHASE 2b: Audience + content matrix (~8s)
    // Uses stored snapshot data — no re-fetching Instagram
    // ════════════════════════════════════════════════════
    if (phase === '2b') {
      const { analyseAudiencePortrait, analyseContentMatrix } = await import('$lib/server/brandIntelligence');
      const { fetchInstagramProfile } = await import('$lib/server/instagram');

      const profile = await fetchInstagramProfile(token);
      const today = new Date().toISOString().split('T')[0];

      // Get stored snapshot from phase 1
      const snapRes = await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${esc}&snapshot_date=eq.${today}&select=*`, { headers: h });
      const snaps = snapRes.ok ? await snapRes.json() : [];
      const snap = snaps[0];
      if (!snap) return json({ ok: true, phase: '2b', message: 'No snapshot — run phase 1 first' });

      const intel = snap.intelligence || {};
      const identity = intel.identity || brand.brand_identity || {};
      const formatBreakdown = snap.content_performance?.formatBreakdown || {};

      // Build basic post insights from snapshot metrics (no re-fetching)
      const basicPostInsights = [{
        mediaId: '', mediaType: 'IMAGE', timestamp: new Date().toISOString(),
        caption: (identity as any)?.rawSummary?.slice(0, 200) || '',
        permalink: '', thumbnail: '',
        likes: Math.round(snap.avg_likes || 0), comments: Math.round(snap.avg_comments || 0),
        impressions: 0, reach: Math.round(snap.avg_reach || 0),
        saved: Math.round(snap.avg_saves || 0), shares: Math.round(snap.avg_shares || 0),
        videoViews: 0, engagement: Math.round((snap.avg_likes || 0) + (snap.avg_comments || 0)),
      }];

      // Empty demographics object with proper structure
      const emptyDemographics = {
        ageBuckets: {} as Record<string, number>,
        genderSplit: { male: 0, female: 0, unknown: 0 },
        topCities: [] as Array<{ city: string; pct: number }>,
        topCountries: [] as Array<{ country: string; pct: number }>,
      };

      const [audiencePortrait, contentMatrix] = await Promise.all([
        analyseAudiencePortrait(emptyDemographics, profile, basicPostInsights as any, anthropicKey),
        analyseContentMatrix(basicPostInsights as any, profile, formatBreakdown, anthropicKey),
      ]);

      intel.audiencePortrait = audiencePortrait;
      intel.contentMatrix = contentMatrix;
      await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${esc}&snapshot_date=eq.${today}`, {
        method: 'PATCH', headers: h, body: JSON.stringify({ intelligence: intel }),
      });

      return json({ ok: true, phase: '2b', message: 'Audience + content analysed' });
    }

    // ════════════════════════════════════════════════════
    // PHASE 2c: Strategic positioning + brief (~8s)
    // ════════════════════════════════════════════════════
    if (phase === '2c') {
      const { analyseStrategicPositioning, computePostingHeatmap, computeHashtags, computeGrowthTrend, fetchPostInsights } = await import('$lib/server/brandIntelligence');
      const { computeTrajectory, generateWeeklyBrief } = await import('$lib/server/brandTrajectory');
      const { fetchInstagramProfile, fetchInstagramMedia } = await import('$lib/server/instagram');

      const profile = await fetchInstagramProfile(token);
      const today = new Date().toISOString().split('T')[0];

      // Get current snapshot
      const snapRes = await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${esc}&snapshot_date=eq.${today}&select=*`, { headers: h });
      const snaps = snapRes.ok ? await snapRes.json() : [];
      const snap = snaps[0];
      if (!snap) return json({ ok: true, phase: '2c', message: 'No snapshot found — run phase 1 first' });

      const intel = snap.intelligence || {};
      const identity = intel.identity || brand.brand_identity || {};
      const audiencePortrait = intel.audiencePortrait || { narrative: '', primaryDemographic: {}, personas: [] };
      const contentMatrix = intel.contentMatrix || { reachDrivers: '', saveDrivers: '', shareDrivers: '' };
      const topHashtags = intel.topHashtags || [];

      const strategicPositioning = await analyseStrategicPositioning(
        profile, identity, audiencePortrait, contentMatrix, '',
        snap.engagement_rate || 0, 0, topHashtags, anthropicKey,
      );

      intel.strategicPositioning = strategicPositioning;
      await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${esc}&snapshot_date=eq.${today}`, {
        method: 'PATCH', headers: h, body: JSON.stringify({ intelligence: intel }),
      });

      // Generate brief
      const historyRes = await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${esc}&order=snapshot_date.desc&limit=5`, { headers: h });
      const history = historyRes.ok ? await historyRes.json() : [];
      const trajectory = computeTrajectory(history[0] || snap, history[1] || null, history);
      const brief = await generateWeeklyBrief(trajectory, intel, { username: brand.ig_username, name: brand.ig_name, followers_count: profile.followers_count || 0 }, anthropicKey);

      await fetch(`${supabaseUrl}/rest/v1/brand_weekly_briefs?on_conflict=brand_ig_id,brief_date`, {
        method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ brand_ig_id: igUserId, brief_date: today, headline: brief.headline, sections: brief.sections, key_metrics: brief.keyMetrics }),
      });

      return json({ ok: true, phase: '2c', message: 'Strategy + brief generated' });
    }

    // ════════════════════════════════════════════════════
    // PHASE 2d: Content proposals only (~8s)
    // ════════════════════════════════════════════════════
    if (phase === '2d') {
      const { generateContentProposals } = await import('$lib/server/brandProposals');

      const today = new Date().toISOString().split('T')[0];
      const snapRes = await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${esc}&snapshot_date=eq.${today}&select=*`, { headers: h });
      const snaps = snapRes.ok ? await snapRes.json() : [];
      const snap = snaps[0];
      if (!snap) return json({ ok: true, phase: '2d', message: 'No snapshot' });

      const intel = snap.intelligence || {};
      const intelligence = {
        profile: { username: brand.ig_username, name: brand.ig_name, followers_count: brand.ig_followers_count, biography: '', media_count: snap.media_count || 0 },
        postInsights: [], accountInsights: { impressions7d: 0, reach7d: 0, profileViews7d: 0, onlineFollowers: null },
        demographics: { ageBuckets: {}, genderSplit: { male: 0, female: 0, unknown: 0 }, topCities: [], topCountries: [] },
        contentPerformance: { formatBreakdown: snap.content_performance?.formatBreakdown || {}, topPostIds: [], bottomPostIds: [], contentArchetypes: [], reachDrivers: '', saveDrivers: '', shareDrivers: '' },
        audiencePortrait: intel.audiencePortrait || { narrative: '', primaryDemographic: {}, personas: [] },
        strategicPositioning: intel.strategicPositioning || { brandDirection: '', contentPillars: [], voiceGuidelines: '', competitiveGaps: '', bigBet: '', quickWins: [] },
        identity: intel.identity || brand.brand_identity || {},
        postingHeatmap: intel.postingHeatmap || [], bestHours: intel.bestHours || [], bestDays: intel.bestDays || [],
        topHashtags: intel.topHashtags || [],
        engagementRate: snap.engagement_rate || 0, avgPerPost: 0, postsPerWeek: snap.posts_per_week || 0, growthTrend: 0,
      };

      const contentProposals = await generateContentProposals(intelligence as any, anthropicKey);

      for (const proposal of contentProposals) {
        await fetch(`${supabaseUrl}/rest/v1/brand_action_proposals`, {
          method: 'POST', headers: h,
          body: JSON.stringify({
            brand_ig_id: igUserId, type: proposal.type,
            title: (proposal as any).title || '', payload: proposal,
            reasoning: (proposal as any).reasoning || '', urgency: 'medium',
          }),
        });
      }

      return json({ ok: true, phase: '2d', message: `${contentProposals.length} content proposals` });
    }

    // ════════════════════════════════════════════════════
    // PHASE 2e: Creator matches (~8s)
    // ════════════════════════════════════════════════════
    if (phase === '2e') {
      const { generateCreatorMatchProposals } = await import('$lib/server/brandProposals');

      const today = new Date().toISOString().split('T')[0];
      const snapRes = await fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${esc}&snapshot_date=eq.${today}&select=intelligence`, { headers: h });
      const snaps = snapRes.ok ? await snapRes.json() : [];
      const snap = snaps[0];
      if (!snap) return json({ ok: true, phase: '2e', message: 'No snapshot' });

      const intel = snap.intelligence || {};
      const intelligence = {
        profile: { username: brand.ig_username, name: brand.ig_name, followers_count: brand.ig_followers_count, biography: '' },
        identity: intel.identity || brand.brand_identity || {},
        audiencePortrait: intel.audiencePortrait || { narrative: '' },
        strategicPositioning: intel.strategicPositioning || { brandDirection: '', contentPillars: [] },
      };

      const creatorProposals = await generateCreatorMatchProposals(intelligence as any, anthropicKey);

      for (const proposal of creatorProposals) {
        await fetch(`${supabaseUrl}/rest/v1/brand_action_proposals`, {
          method: 'POST', headers: h,
          body: JSON.stringify({
            brand_ig_id: igUserId, type: proposal.type,
            title: (proposal as any).name || '', payload: proposal,
            reasoning: (proposal as any).matchReasoning || '', urgency: 'medium',
          }),
        });
      }

      return json({ ok: true, phase: '2e', message: `${creatorProposals.length} creator matches` });
    }

    return json({ ok: false, error: 'Invalid phase' }, { status: 400 });
  } catch (e) {
    console.error(`[Intelligence] Phase ${phase} failed:`, e);
    return json({ ok: false, error: e instanceof Error ? e.message : 'Failed', phase }, { status: 500 });
  }
};
