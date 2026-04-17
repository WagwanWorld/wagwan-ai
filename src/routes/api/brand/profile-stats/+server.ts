import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw error(500, 'Supabase not configured');

  // Get brand token + stored identity
  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&select=ig_access_token,ig_username,ig_name,ig_profile_picture,ig_followers_count,brand_identity,identity_updated_at&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const brands = await brandRes.json();
  if (!brands.length) throw error(404, 'Brand not found');
  const brand = brands[0];
  const token = brand.ig_access_token;

  // Fetch profile info (fresh from IG)
  const profileRes = await fetch(
    `https://graph.instagram.com/v25.0/me?fields=id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count&access_token=${token}`,
  );
  const profile = profileRes.ok ? await profileRes.json() : {};

  // Fetch last 10 posts with engagement metrics
  const mediaRes = await fetch(
    `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url,media_url&limit=10&access_token=${token}`,
  );
  const mediaJson = mediaRes.ok ? await mediaRes.json() : { data: [] };
  const recentPosts = mediaJson.data || [];

  // Calculate engagement stats
  let totalLikes = 0;
  let totalComments = 0;
  for (const post of recentPosts) {
    totalLikes += post.like_count || 0;
    totalComments += post.comments_count || 0;
  }
  const avgEngagement = recentPosts.length
    ? Math.round((totalLikes + totalComments) / recentPosts.length)
    : 0;
  const engagementRate = profile.followers_count
    ? ((totalLikes + totalComments) / recentPosts.length / profile.followers_count * 100).toFixed(2)
    : '0';

  // Posting frequency (posts per week based on last 10)
  let postsPerWeek = 0;
  if (recentPosts.length >= 2) {
    const newest = new Date(recentPosts[0].timestamp).getTime();
    const oldest = new Date(recentPosts[recentPosts.length - 1].timestamp).getTime();
    const daySpan = (newest - oldest) / (1000 * 60 * 60 * 24);
    postsPerWeek = daySpan > 0 ? Math.round((recentPosts.length / daySpan) * 7 * 10) / 10 : 0;
  }

  // Get scheduled post counts
  const scheduledRes = await fetch(
    `${supabaseUrl}/rest/v1/scheduled_posts?brand_ig_id=eq.${encodeURIComponent(igUserId)}&select=status`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const scheduledPosts = scheduledRes.ok ? await scheduledRes.json() : [];
  const scheduledCount = scheduledPosts.filter((p: { status: string }) => p.status === 'scheduled').length;
  const publishedCount = scheduledPosts.filter((p: { status: string }) => p.status === 'published').length;

  return json({
    ok: true,
    profile: {
      username: profile.username || brand.ig_username,
      name: profile.name || brand.ig_name,
      biography: profile.biography || '',
      profilePicture: profile.profile_picture_url || brand.ig_profile_picture,
      followersCount: profile.followers_count || brand.ig_followers_count,
      followingCount: profile.follows_count || 0,
      mediaCount: profile.media_count || 0,
    },
    engagement: {
      avgEngagement,
      engagementRate,
      totalLikes,
      totalComments,
      postsPerWeek,
    },
    recentPosts,
    scheduling: {
      scheduled: scheduledCount,
      published: publishedCount,
      total: scheduledPosts.length,
    },
    brandIdentity: brand.brand_identity || null,
    identityUpdatedAt: brand.identity_updated_at || null,
  });
};
