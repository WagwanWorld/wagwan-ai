import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { computeGrowthDeltas } from '$lib/server/brand/followerAnalytics';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) return json({ ok: false, error: 'auth_required' }, { status: 401 });

  const sb = getServiceSupabase();
  const { data: snapshots } = await sb
    .from('follower_snapshots')
    .select('snapshot_date,followers,follows_count,media_count')
    .eq('brand_ig_id', igUserId)
    .order('snapshot_date', { ascending: false })
    .limit(90);

  if (!snapshots?.length) {
    // Fallback: get current follower count from brand_accounts
    const { data: brand } = await sb
      .from('brand_accounts')
      .select('ig_followers_count')
      .eq('ig_user_id', igUserId)
      .maybeSingle();
    return json({
      ok: true,
      summary: {
        current: Number(brand?.ig_followers_count ?? 0),
        delta24h: 0,
        delta7d: 0,
        delta30d: 0,
        growthRate7d: 0,
        growthRate30d: 0,
        asOf: null,
      },
    });
  }

  const deltas = computeGrowthDeltas(snapshots);
  const latest = snapshots[0];

  return json({
    ok: true,
    summary: {
      ...deltas,
      followsCount: latest.follows_count || 0,
      mediaCount: latest.media_count || 0,
      asOf: latest.snapshot_date,
    },
  });
};
