import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import pg from 'pg';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    const { rows: [brand] } = await pool.query(
      `SELECT ig_access_token FROM brand_accounts WHERE ig_user_id = $1`,
      [igUserId],
    );
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

    await pool.query(
      `INSERT INTO brand_insights_cache (brand_ig_id, insights_data) VALUES ($1, $2)`,
      [igUserId, JSON.stringify(insightsData)],
    );

    return json({ ok: true, insights: insightsData });
  } finally {
    await pool.end();
  }
};
