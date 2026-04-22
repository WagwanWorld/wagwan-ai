// src/routes/api/brand/intelligence/trajectory/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { computeTrajectory } from '$lib/server/brandTrajectory';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=snapshot_date.desc&limit=12`,
    { headers },
  );
  const snapshots = res.ok ? await res.json() : [];

  if (snapshots.length < 2) {
    return json({ ok: true, trajectory: null, snapshots, message: 'Need at least 2 weekly snapshots for trajectory analysis.' });
  }

  const trajectory = computeTrajectory(snapshots[0], snapshots[1], snapshots);
  return json({ ok: true, trajectory, snapshots });
};
