import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import pg from 'pg';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const status = url.searchParams.get('status');

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    let query = `SELECT * FROM scheduled_posts WHERE brand_ig_id = $1`;
    const params: (string | null)[] = [igUserId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT 50`;

    const { rows } = await pool.query(query, params);
    return json({ ok: true, posts: rows });
  } finally {
    await pool.end();
  }
};
