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

  const today = new Date().toISOString().slice(0, 10);
  const results: Array<{ brand: string; ok: boolean; error?: string }> = [];

  for (const b of brands) {
    const igUserId = String(b.ig_user_id);
    const token = b.ig_access_token as string;
    if (!token) {
      results.push({ brand: igUserId, ok: false, error: 'no_token' });
      continue;
    }

    try {
      // Fetch live profile data
      const profileRes = await fetch(
        `https://graph.instagram.com/v25.0/${igUserId}?fields=followers_count,follows_count,media_count&access_token=${token}`,
      );
      let followers = Number(b.ig_followers_count ?? 0);
      let followsCount = 0;
      let mediaCount = 0;
      if (profileRes.ok) {
        const p = await profileRes.json();
        followers = p.followers_count ?? followers;
        followsCount = p.follows_count ?? 0;
        mediaCount = p.media_count ?? 0;
      }

      // Fetch 28-day reach
      let reach28d = 0;
      try {
        const until = Math.floor(Date.now() / 1000);
        const since = until - 28 * 86400;
        const reachRes = await fetch(
          `https://graph.instagram.com/v25.0/${igUserId}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${token}`,
        );
        if (reachRes.ok) {
          const rd = await reachRes.json();
          const values = rd?.data?.[0]?.values || [];
          reach28d = values.reduce((s: number, v: { value: number }) => s + (v.value || 0), 0);
        }
      } catch {
        /* reach unavailable */
      }

      // Update brand_accounts with latest follower count
      await sb
        .from('brand_accounts')
        .update({ ig_followers_count: followers })
        .eq('ig_user_id', igUserId);

      // UPSERT follower snapshot
      await sb.from('follower_snapshots').upsert(
        {
          brand_ig_id: igUserId,
          snapshot_date: today,
          followers,
          follows_count: followsCount,
          media_count: mediaCount,
          reach_28d: reach28d,
        },
        { onConflict: 'brand_ig_id,snapshot_date' },
      );

      results.push({ brand: igUserId, ok: true });
    } catch (e) {
      results.push({
        brand: igUserId,
        ok: false,
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  return json({ ok: true, date: today, processed: results.length, results });
};
