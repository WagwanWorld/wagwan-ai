// src/routes/api/brand/intelligence/content-matrix/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&select=content_performance,intelligence&order=snapshot_date.desc&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const rows = res.ok ? await res.json() : [];
  if (!rows.length) return json({ ok: true, contentPerformance: null });

  return json({ ok: true, contentPerformance: rows[0].content_performance });
};
