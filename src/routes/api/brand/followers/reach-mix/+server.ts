import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) return json({ ok: false, error: 'auth_required' }, { status: 401 });

  const days = url.searchParams.get('range') === '90d' ? 90 : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const sb = getServiceSupabase();
  const { data: rows } = await sb
    .from('post_follow_attribution')
    .select('reach_followers,reach_non_followers')
    .eq('brand_ig_id', igUserId)
    .gte('posted_at', since);

  let followerReach = 0;
  let nonFollowerReach = 0;
  for (const r of rows ?? []) {
    followerReach += r.reach_followers || 0;
    nonFollowerReach += r.reach_non_followers || 0;
  }
  const totalReach = followerReach + nonFollowerReach;

  return json({
    ok: true,
    range: `${days}d`,
    followerReach,
    nonFollowerReach,
    totalReach,
    nonFollowerPct: totalReach > 0 ? Math.round((nonFollowerReach / totalReach) * 1000) / 10 : 0,
  });
};
