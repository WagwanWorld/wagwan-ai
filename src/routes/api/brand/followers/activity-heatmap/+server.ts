import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { computeRecommendedWindows } from '$lib/server/brand/followerAnalytics';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) return json({ ok: false, error: 'auth_required' }, { status: 401 });

  const sb = getServiceSupabase();

  // Get the latest week's data
  const { data: latestWeek } = await sb
    .from('online_activity_snapshots')
    .select('snapshot_week')
    .eq('brand_ig_id', igUserId)
    .order('snapshot_week', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestWeek) {
    return json({ ok: true, grid: [], recommendedWindows: [], snapshotWeek: null });
  }

  const { data: rows } = await sb
    .from('online_activity_snapshots')
    .select('day_of_week,hour_of_day,value')
    .eq('brand_ig_id', igUserId)
    .eq('snapshot_week', latestWeek.snapshot_week)
    .order('day_of_week')
    .order('hour_of_day');

  const grid = (rows ?? []).map((r) => ({
    day: r.day_of_week,
    hour: r.hour_of_day,
    value: r.value,
  }));

  const recommendedWindows = computeRecommendedWindows(grid);

  return json({ ok: true, grid, recommendedWindows, snapshotWeek: latestWeek.snapshot_week });
};
