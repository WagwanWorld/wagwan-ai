import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { computeMomentum } from '$lib/server/brand/followerAnalytics';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) return json({ ok: false, error: 'auth_required' }, { status: 401 });

  const sb = getServiceSupabase();
  const { data: snapshots } = await sb
    .from('follower_snapshots')
    .select('snapshot_date,followers')
    .eq('brand_ig_id', igUserId)
    .order('snapshot_date', { ascending: false })
    .limit(30);

  if (!snapshots?.length || snapshots.length < 2) {
    return json({ ok: true, momentum: 1, avg7d: 0, avg28d: 0, trend: 'steady' as const });
  }

  const result = computeMomentum(snapshots);
  return json({ ok: true, ...result });
};
