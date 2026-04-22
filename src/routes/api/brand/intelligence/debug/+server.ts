import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

/** Diagnostic endpoint — tests each Instagram API call individually */
export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  // Get brand token
  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&select=ig_access_token,ig_username&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const brands = await brandRes.json();
  if (!brands.length) throw error(404, 'Brand not found');
  const token = brands[0].ig_access_token;
  const username = brands[0].ig_username;

  const results: Record<string, unknown> = { username, igUserId };

  // 1. Test profile
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/me?fields=id,username,name,account_type,biography,profile_picture_url,followers_count,follows_count,media_count&access_token=${token}`,
    );
    const data = await res.json();
    results.profile = { status: res.status, account_type: data.account_type, followers: data.followers_count, media_count: data.media_count, error: data.error };
  } catch (e: any) {
    results.profile = { error: e.message };
  }

  // 2. Test media fetch
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count&limit=3&access_token=${token}`,
    );
    const data = await res.json();
    const posts = data.data || [];
    results.media = { status: res.status, count: posts.length, firstPost: posts[0] ? { id: posts[0].id, type: posts[0].media_type, likes: posts[0].like_count } : null, error: data.error };

    // 3. Test per-post insights on first post
    if (posts[0]) {
      try {
        const insRes = await fetch(
          `https://graph.instagram.com/v25.0/${posts[0].id}/insights?metric=impressions,reach,saved,shares&access_token=${token}`,
        );
        const insData = await insRes.json();
        results.postInsights = { status: insRes.status, data: insData.data, error: insData.error };
      } catch (e: any) {
        results.postInsights = { error: e.message };
      }

      // Also try individual metrics
      for (const metric of ['impressions', 'reach', 'saved', 'shares']) {
        try {
          const mRes = await fetch(
            `https://graph.instagram.com/v25.0/${posts[0].id}/insights?metric=${metric}&access_token=${token}`,
          );
          const mData = await mRes.json();
          results[`postInsight_${metric}`] = { status: mRes.status, data: mData.data?.[0], error: mData.error };
        } catch (e: any) {
          results[`postInsight_${metric}`] = { error: e.message };
        }
      }
    }
  } catch (e: any) {
    results.media = { error: e.message };
  }

  // 4. Test account insights - impressions
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=impressions&period=day&since=${Math.floor(Date.now() / 1000) - 7 * 86400}&until=${Math.floor(Date.now() / 1000)}&access_token=${token}`,
    );
    const data = await res.json();
    results.accountInsights_impressions = { status: res.status, data: data.data?.[0]?.values?.slice(0, 2), error: data.error };
  } catch (e: any) {
    results.accountInsights_impressions = { error: e.message };
  }

  // 5. Test account insights - reach
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=reach&period=day&since=${Math.floor(Date.now() / 1000) - 7 * 86400}&until=${Math.floor(Date.now() / 1000)}&access_token=${token}`,
    );
    const data = await res.json();
    results.accountInsights_reach = { status: res.status, data: data.data?.[0]?.values?.slice(0, 2), error: data.error };
  } catch (e: any) {
    results.accountInsights_reach = { error: e.message };
  }

  // 6. Test demographics
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age,gender,city,country&access_token=${token}`,
    );
    const data = await res.json();
    results.demographics = { status: res.status, hasData: !!data.data?.length, rawSample: JSON.stringify(data).slice(0, 500), error: data.error };
  } catch (e: any) {
    results.demographics = { error: e.message };
  }

  // 7. Test online followers
  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=online_followers&period=lifetime&access_token=${token}`,
    );
    const data = await res.json();
    results.onlineFollowers = { status: res.status, hasData: !!data.data?.length, error: data.error };
  } catch (e: any) {
    results.onlineFollowers = { error: e.message };
  }

  return json(results);
};
