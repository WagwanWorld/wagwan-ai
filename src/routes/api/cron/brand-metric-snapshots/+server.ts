import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/server/supabase';
import { snapshotPostMetrics } from '$lib/server/brand/brandOsEngine';

const ALLOWED_BUCKETS = new Set(['1h', '6h', '24h', '3d', '7d', '14d', '30d']);

export const GET: RequestHandler = async ({ request, url }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bucket = String(url.searchParams.get('bucket') || '').trim();
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return json({ error: 'Invalid bucket' }, { status: 400 });
  }

  const sb = getServiceSupabase();
  const { data: brands, error } = await sb.from('brand_accounts').select('ig_user_id');
  if (error) {
    return json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{ brand: string; inserted: number }> = [];
  for (const b of brands ?? []) {
    const inserted = await snapshotPostMetrics(String(b.ig_user_id), bucket);
    results.push({ brand: String(b.ig_user_id), inserted });
  }

  return json({ ok: true, bucket, processed: results.length, results });
};
