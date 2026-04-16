import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { generateContentPlan } from '$lib/server/marketplace/contentPlanGenerator';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { creatives } = body as {
    creatives: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO'; fileName: string }>;
  };
  if (!creatives?.length) throw error(400, 'No creatives provided');

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${igUserId}&select=ig_username,ig_name,ig_followers_count,ig_access_token&limit=1`,
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

  const cacheRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_insights_cache?brand_ig_id=eq.${igUserId}&select=insights_data&order=fetched_at.desc&limit=1`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );

  const cacheRows = cacheRes.ok ? await cacheRes.json() : [];
  const cached = cacheRows[0];

  let insightsData = cached?.insights_data || null;
  let recentPosts = insightsData?.recentPosts || [];

  if (!insightsData) {
    const mediaRes = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/media?fields=caption,media_type,timestamp,like_count,comments_count&limit=10&access_token=${brand.ig_access_token}`,
    );
    const mediaJson = mediaRes.ok ? await mediaRes.json() : { data: [] };
    recentPosts = mediaJson.data || [];
  }

  const plan = await generateContentPlan(
    creatives,
    { username: brand.ig_username, name: brand.ig_name, followersCount: brand.ig_followers_count },
    recentPosts,
    insightsData,
  );

  return json({ ok: true, plan });
};
