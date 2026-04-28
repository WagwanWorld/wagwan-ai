import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY || '' });

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { assets, context } = body as {
    assets: Array<{ gcsUrl: string; mediaType: string; fileName?: string }>;
    context?: string;
  };
  if (!assets?.length) throw error(400, 'No assets provided');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  // Fetch brand profile + voice
  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${igUserId}&select=ig_username,ig_name,ig_followers_count,brand_identity,brand_voice&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const brandRows = await brandRes.json();
  const brand = brandRows[0];
  if (!brand) throw error(404, 'Brand not found');

  // Fetch brand snapshot for pillars + audience
  const snapRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${igUserId}&select=intelligence&order=created_at.desc&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const snapRows = snapRes.ok ? await snapRes.json() : [];
  const intelligence = snapRows[0]?.intelligence || {};

  // Fetch recent post performance for hashtag/content patterns
  const postsRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_fingerprints?brand_ig_id=eq.${igUserId}&order=posted_at.desc&limit=10&select=caption,hashtags,hook_archetype,engagement_score`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const recentFingerprints = postsRes.ok ? await postsRes.json() : [];

  const brandVoice = brand.brand_voice || 'Bold';
  const identity = brand.brand_identity || {};
  const pillars = intelligence.contentPillars || [];
  const audience = intelligence.audiencePersonas || [];
  const topHashtags = recentFingerprints
    .flatMap((p: Record<string, unknown>) => (p.hashtags as string[]) || [])
    .reduce((acc: Record<string, number>, h: string) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {});
  const sortedHashtags = Object.entries(topHashtags)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 15)
    .map(([h]) => h);

  // Build prompt parts with images for vision
  const contentParts: Anthropic.Messages.ContentBlockParam[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (asset.mediaType === 'IMAGE' || asset.mediaType === 'CAROUSEL') {
      try {
        const imgRes = await fetch(asset.gcsUrl);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          contentParts.push({ type: 'text', text: `Asset ${i + 1} (${asset.fileName || 'image'}):` });
          contentParts.push({
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          });
        } else {
          contentParts.push({ type: 'text', text: `Asset ${i + 1}: ${asset.fileName || 'image'} (could not load for vision)` });
        }
      } catch {
        contentParts.push({ type: 'text', text: `Asset ${i + 1}: ${asset.fileName || 'image'} (could not load)` });
      }
    } else {
      contentParts.push({
        type: 'text',
        text: `Asset ${i + 1}: ${asset.fileName || 'video'} (${asset.mediaType}) — generate based on filename and brand context`,
      });
    }
  }

  contentParts.push({
    type: 'text',
    text: `You are a social media content writer for @${brand.ig_username} (${brand.ig_name}, ${brand.ig_followers_count} followers).

BRAND VOICE: ${brandVoice}
${identity.bio ? `BIO: ${identity.bio}` : ''}
${pillars.length ? `CONTENT PILLARS: ${pillars.join(', ')}` : ''}
${audience.length ? `AUDIENCE: ${audience.map((a: Record<string, string>) => a.name || a.label).join(', ')}` : ''}
${sortedHashtags.length ? `BRAND'S TOP HASHTAGS: ${sortedHashtags.join(', ')}` : ''}
${context ? `USER CONTEXT: ${context}` : ''}

For each asset above, generate:
1. **caption**: On-brand copy in the ${brandVoice} voice. Max 2200 chars. Include a CTA.
   - For Reels: hook-first copy (grab attention in first line)
   - For Carousels: reference the multi-slide format
   - For Posts: engagement-focused with CTA
   - For Stories: short, casual, conversational
2. **hashtags**: Array of 8-15 hashtags. Mix branded tags and trending/topical tags. No # prefix.
3. **mentions**: Array of @handles to tag (from brand context, collaborators). No @ prefix.
4. **location**: Suggested location tag based on brand profile or content.
5. **altText**: Accessibility description of the visual (1-2 sentences).
6. **postType**: Best format — one of IMAGE, VIDEO, REELS, STORIES, CAROUSEL.

Respond as a JSON array, one object per asset:
[{ "caption": "...", "hashtags": [...], "mentions": [...], "location": "...", "altText": "...", "postType": "..." }]

JSON only, no markdown.`,
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: contentParts }],
  });

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let results;
  try {
    results = JSON.parse(text);
  } catch {
    throw error(500, 'AI returned invalid JSON');
  }

  // Merge gcsUrl back into results
  const merged = assets.map((asset, i) => ({
    gcsUrl: asset.gcsUrl,
    mediaType: asset.mediaType,
    fileName: asset.fileName,
    ...results[i],
  }));

  // Log activity
  for (const asset of merged) {
    await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_ig_id: igUserId,
        event_type: 'generated',
        event_data: { gcsUrl: asset.gcsUrl, postType: asset.postType },
      }),
    });
  }

  return json({ ok: true, results: merged, brandVoice });
};
