import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${igUserId}&select=ig_access_token&limit=1`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );

  if (!brandRes.ok) {
    const errText = await brandRes.text();
    throw error(500, `Database error fetching brand: ${errText}`);
  }

  const brandRows = await brandRes.json();
  const brand = brandRows[0];
  if (!brand) throw error(404, 'Brand not found');
  const token = brand.ig_access_token;

  const insightsRes = await fetch(
    `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=online_followers&period=lifetime&access_token=${token}`,
  );
  const insightsJson = insightsRes.ok ? await insightsRes.json() : { data: [] };
  const onlineFollowers = insightsJson.data?.[0]?.values?.[0]?.value || {};

  const mediaRes = await fetch(
    `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink&limit=10&access_token=${token}`,
  );
  const mediaJson = mediaRes.ok ? await mediaRes.json() : { data: [] };
  const recentPosts = mediaJson.data || [];

  const hourCounts: Record<number, { total: number; engagement: number }> = {};
  for (const post of recentPosts) {
    const hour = new Date(post.timestamp).getHours();
    if (!hourCounts[hour]) hourCounts[hour] = { total: 0, engagement: 0 };
    hourCounts[hour].total += 1;
    hourCounts[hour].engagement += (post.like_count || 0) + (post.comments_count || 0);
  }
  const topPostingHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => (b.engagement / b.total) - (a.engagement / a.total))
    .slice(0, 5)
    .map(([h]) => parseInt(h));

  const insightsData = { onlineFollowers, topPostingHours, recentPosts };

  await fetch(`${supabaseUrl}/rest/v1/brand_insights_cache`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      brand_ig_id: igUserId,
      insights_data: insightsData,
    }),
  });

  return json({ ok: true, insights: insightsData });
};
