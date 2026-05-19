import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/server/supabase';

export const config = { maxDuration: 120 };

const BREAKDOWNS = ['age', 'gender', 'city', 'country'] as const;

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getServiceSupabase();
  const { data: brands } = await sb
    .from('brand_accounts')
    .select('ig_user_id,ig_access_token,ig_followers_count');
  if (!brands?.length) return json({ ok: true, processed: 0 });

  // Use Monday of current week as snapshot_week
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
  const snapshotWeek = monday.toISOString().slice(0, 10);

  const results: Array<{ brand: string; ok: boolean; breakdowns?: number; error?: string }> = [];

  for (const b of brands) {
    const igUserId = String(b.ig_user_id);
    const token = b.ig_access_token as string;
    if (!token) {
      results.push({ brand: igUserId, ok: false, error: 'no_token' });
      continue;
    }

    // Skip accounts with fewer than 100 followers (demographics unavailable)
    if (Number(b.ig_followers_count ?? 0) < 100) {
      results.push({ brand: igUserId, ok: true, breakdowns: 0 });
      continue;
    }

    try {
      let savedCount = 0;
      for (const breakdown of BREAKDOWNS) {
        try {
          const res = await fetch(
            `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${breakdown}&access_token=${token}`,
          );
          if (!res.ok) continue;
          const json = await res.json();
          const breakdownData = json?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
          const data: Record<string, number> = {};
          for (const entry of breakdownData) {
            const key = entry.dimension_values?.[0] || 'unknown';
            data[key] = entry.value || 0;
          }

          await sb.from('demographic_snapshots').upsert(
            {
              brand_ig_id: igUserId,
              snapshot_week: snapshotWeek,
              breakdown_type: breakdown,
              data,
            },
            { onConflict: 'brand_ig_id,snapshot_week,breakdown_type' },
          );
          savedCount++;
        } catch {
          // Individual breakdown failed — continue with others
        }
      }
      results.push({ brand: igUserId, ok: true, breakdowns: savedCount });
    } catch (e) {
      results.push({
        brand: igUserId,
        ok: false,
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  return json({ ok: true, week: snapshotWeek, processed: results.length, results });
};
