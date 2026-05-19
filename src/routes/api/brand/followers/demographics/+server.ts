import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) return json({ ok: false, error: 'auth_required' }, { status: 401 });

  const breakdown = url.searchParams.get('breakdown') || 'age';
  if (!['age', 'gender', 'city', 'country'].includes(breakdown)) {
    return json({ ok: false, error: 'invalid_breakdown' }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data: row } = await sb
    .from('demographic_snapshots')
    .select('snapshot_week,data')
    .eq('brand_ig_id', igUserId)
    .eq('breakdown_type', breakdown)
    .order('snapshot_week', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return json({ ok: true, breakdown, data: [], snapshotWeek: null });
  }

  const rawData = (row.data || {}) as Record<string, number>;
  const total = Object.values(rawData).reduce((s, v) => s + v, 0) || 1;
  const data = Object.entries(rawData)
    .map(([dimensionValue, count]) => ({
      dimensionValue,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  return json({ ok: true, breakdown, data, snapshotWeek: row.snapshot_week });
};
