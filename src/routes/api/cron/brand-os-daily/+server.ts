import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/server/supabase';
import {
  computePillars,
  generateDailyBrief,
  runInsightDetectors,
} from '$lib/server/brand/brandOsEngine';

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getServiceSupabase();
  const { data: brands, error } = await sb.from('brand_accounts').select('ig_user_id');
  if (error) {
    return json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{ brand: string; findings: number; actions: number }> = [];
  for (const b of brands ?? []) {
    const brandId = String(b.ig_user_id);
    await computePillars(brandId);
    const findings = await runInsightDetectors(brandId);
    const brief = await generateDailyBrief(brandId);
    results.push({ brand: brandId, findings: findings.length, actions: brief.actions.length });
  }

  return json({ ok: true, processed: results.length, results });
};
