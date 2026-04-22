// src/routes/api/brand/intelligence/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=snapshot_date.desc&limit=1`,
    { headers },
  );
  const rows = res.ok ? await res.json() : [];

  if (!rows.length) {
    return json({ ok: true, snapshot: null, message: 'No intelligence data yet. Run a manual refresh or wait for the weekly analysis.' });
  }

  return json({ ok: true, snapshot: rows[0] });
};
