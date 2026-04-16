import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { generateContentPlan } from '$lib/server/marketplace/contentPlanGenerator';
import pg from 'pg';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { creatives } = body as {
    creatives: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO'; fileName: string }>;
  };
  if (!creatives?.length) throw error(400, 'No creatives provided');

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    const { rows: [brand] } = await pool.query(
      `SELECT ig_username, ig_name, ig_followers_count, ig_access_token FROM brand_accounts WHERE ig_user_id = $1`,
      [igUserId],
    );
    if (!brand) throw error(404, 'Brand not found');

    const { rows: [cached] } = await pool.query(
      `SELECT insights_data FROM brand_insights_cache WHERE brand_ig_id = $1 ORDER BY fetched_at DESC LIMIT 1`,
      [igUserId],
    );

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
  } finally {
    await pool.end();
  }
};
