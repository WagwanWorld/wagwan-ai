import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/server/supabase';

export const config = { maxDuration: 120 };

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

  // Monday of current week
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
  const snapshotWeek = monday.toISOString().slice(0, 10);

  const results: Array<{ brand: string; ok: boolean; cells?: number; error?: string }> = [];

  for (const b of brands) {
    const igUserId = String(b.ig_user_id);
    const token = b.ig_access_token as string;
    if (!token) {
      results.push({ brand: igUserId, ok: false, error: 'no_token' });
      continue;
    }
    if (Number(b.ig_followers_count ?? 0) < 100) {
      results.push({ brand: igUserId, ok: true, cells: 0 });
      continue;
    }

    try {
      const res = await fetch(
        `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=online_followers&period=lifetime&access_token=${token}`,
      );
      if (!res.ok) {
        results.push({ brand: igUserId, ok: false, error: `IG API ${res.status}` });
        continue;
      }

      const data = await res.json();
      const rawValue = data?.data?.[0]?.values?.[0]?.value;
      if (!rawValue || typeof rawValue !== 'object') {
        results.push({ brand: igUserId, ok: true, cells: 0 });
        continue;
      }

      // rawValue is { "Mon": [1,2,3,...24 values], "Tue": [...], ... }
      const dayMap: Record<string, number> = {
        Mon: 0,
        Tue: 1,
        Wed: 2,
        Thu: 3,
        Fri: 4,
        Sat: 5,
        Sun: 6,
      };
      const rows: Array<{
        brand_ig_id: string;
        snapshot_week: string;
        day_of_week: number;
        hour_of_day: number;
        value: number;
      }> = [];

      for (const [dayName, hours] of Object.entries(rawValue)) {
        const dayIdx = dayMap[dayName] ?? 0;
        if (!Array.isArray(hours)) continue;
        for (let hour = 0; hour < Math.min(hours.length, 24); hour++) {
          rows.push({
            brand_ig_id: igUserId,
            snapshot_week: snapshotWeek,
            day_of_week: dayIdx,
            hour_of_day: hour,
            value: Number(hours[hour]) || 0,
          });
        }
      }

      if (rows.length > 0) {
        await sb.from('online_activity_snapshots').upsert(rows, {
          onConflict: 'brand_ig_id,snapshot_week,day_of_week,hour_of_day',
        });
      }

      results.push({ brand: igUserId, ok: true, cells: rows.length });
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
