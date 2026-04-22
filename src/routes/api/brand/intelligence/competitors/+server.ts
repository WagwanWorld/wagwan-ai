import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { fetchCompetitorData, analyseCompetitor } from '$lib/server/brandCompetitors';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const [competitorsRes, snapshotRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/brand_competitors?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=created_at.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&select=competitor_data&order=snapshot_date.desc&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    ),
  ]);

  const competitors = competitorsRes.ok ? await competitorsRes.json() : [];
  const snapshots = snapshotRes.ok ? await snapshotRes.json() : [];

  return json({
    ok: true,
    competitors,
    matrix: snapshots[0]?.competitor_data || null,
  });
};

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const body = await request.json();
  const username = (body.username || '').trim().replace(/^@/, '');
  if (!username) throw error(400, 'Username required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const anthropicKey = env.ANTHROPIC_API_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

  // Get brand's access token to look up the competitor
  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&select=ig_access_token&limit=1`,
    { headers },
  );
  const brands = await brandRes.json();
  if (!brands.length) throw error(404, 'Brand not found');
  const brandToken = brands[0].ig_access_token;

  // Search for the competitor's IG user ID using the Instagram Business Discovery API
  let competitorIgId: string | null = null;
  let competitorProfile: any = null;

  try {
    const searchRes = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}?fields=business_discovery.fields(id,username,name,biography,profile_picture_url,followers_count,media_count,media.limit(12){caption,media_type,timestamp,like_count,comments_count})&business_discovery=@${encodeURIComponent(username)}&access_token=${brandToken}`,
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      const bd = data.business_discovery;
      if (bd) {
        competitorIgId = bd.id;
        competitorProfile = {
          profile: {
            username: bd.username || username,
            name: bd.name || '',
            biography: bd.biography || '',
            followers: bd.followers_count || 0,
            mediaCount: bd.media_count || 0,
            profilePicture: bd.profile_picture_url || '',
          },
          posts: (bd.media?.data || []).map((m: any) => ({
            caption: (m.caption || '').slice(0, 200),
            mediaType: m.media_type || 'IMAGE',
            timestamp: m.timestamp || '',
            likes: m.like_count || 0,
            comments: m.comments_count || 0,
          })),
        };
      }
    } else {
      const errData = await searchRes.json().catch(() => ({}));
      console.error(`[Competitors] Business discovery failed for @${username}:`, errData.error?.message || searchRes.status);
    }
  } catch (e) {
    console.error(`[Competitors] Search failed for @${username}:`, e);
  }

  // Store the competitor record
  await fetch(`${supabaseUrl}/rest/v1/brand_competitors?on_conflict=brand_ig_id,competitor_ig_username`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      brand_ig_id: igUserId,
      competitor_ig_username: username,
      competitor_ig_id: competitorIgId,
    }),
  });

  // If we got their data, run analysis immediately
  let analysis = null;
  if (competitorProfile && competitorProfile.posts.length > 0) {
    try {
      analysis = await analyseCompetitor(competitorProfile, anthropicKey);

      // Update the competitor record with analysis
      await fetch(
        `${supabaseUrl}/rest/v1/brand_competitors?brand_ig_id=eq.${encodeURIComponent(igUserId)}&competitor_ig_username=eq.${encodeURIComponent(username)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            competitor_ig_id: competitorIgId,
            latest_analysis: analysis,
            last_analysed_at: new Date().toISOString(),
          }),
        },
      );
    } catch (e) {
      console.error(`[Competitors] Analysis failed for @${username}:`, e);
    }
  }

  return json({
    ok: true,
    added: username,
    igId: competitorIgId,
    analysis,
    notFound: !competitorIgId,
    message: competitorIgId
      ? `@${username} added and analysed.`
      : `@${username} saved but could not be found via Instagram Business Discovery. They may need to be a business/creator account.`,
  });
};
