import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) return json({ ok: false, error: 'auth_required' }, { status: 401 });

  const range = url.searchParams.get('range') === '90d' ? 90 : 30;
  const since = new Date(Date.now() - range * 86400000).toISOString().slice(0, 10);

  const sb = getServiceSupabase();
  const { data: snapshots } = await sb
    .from('follower_snapshots')
    .select('snapshot_date,followers')
    .eq('brand_ig_id', igUserId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });

  let rows = snapshots ?? [];

  // If no snapshots yet, create a single point from brand_accounts
  if (rows.length === 0) {
    const { data: brand } = await sb
      .from('brand_accounts')
      .select('ig_followers_count')
      .eq('ig_user_id', igUserId)
      .maybeSingle();
    const count = Number(brand?.ig_followers_count ?? 0);
    if (count > 0) {
      rows = [{ snapshot_date: new Date().toISOString().slice(0, 10), followers: count }];
    }
  }

  const series = rows.map((s, i) => ({
    date: s.snapshot_date,
    followers: s.followers,
    netNew: i > 0 ? s.followers - rows[i - 1].followers : 0,
  }));

  return json({ ok: true, range: `${range}d`, series });
};
