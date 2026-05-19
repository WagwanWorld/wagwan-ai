import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/server/supabase';

export const config = { maxDuration: 180 };

const MAX_POSTS_PER_BRAND = 25; // Stay well within 200 calls/hour rate limit

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getServiceSupabase();
  const { data: brands } = await sb.from('brand_accounts').select('ig_user_id,ig_access_token');
  if (!brands?.length) return json({ ok: true, processed: 0 });

  const results: Array<{ brand: string; ok: boolean; posts?: number; error?: string }> = [];

  for (const b of brands) {
    const igUserId = String(b.ig_user_id);
    const token = b.ig_access_token as string;
    if (!token) {
      results.push({ brand: igUserId, ok: false, error: 'no_token' });
      continue;
    }

    try {
      // Fetch recent media
      const mediaRes = await fetch(
        `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,media_type,timestamp,caption,permalink&limit=${MAX_POSTS_PER_BRAND}&access_token=${token}`,
      );
      if (!mediaRes.ok) {
        results.push({ brand: igUserId, ok: false, error: `media API ${mediaRes.status}` });
        continue;
      }
      const mediaJson = await mediaRes.json();
      const posts: Array<{
        id: string;
        media_type?: string;
        timestamp?: string;
        caption?: string;
        permalink?: string;
      }> = mediaJson?.data ?? [];

      let synced = 0;
      for (const post of posts.slice(0, MAX_POSTS_PER_BRAND)) {
        try {
          // Fetch per-post insights
          let reach = 0,
            follows = 0,
            profileActivity = 0;
          const insRes = await fetch(
            `https://graph.instagram.com/v25.0/${post.id}/insights?metric=reach,follows,profile_activity&access_token=${token}`,
          );
          if (insRes.ok) {
            const insData = await insRes.json();
            for (const m of insData?.data ?? []) {
              const val = m.values?.[0]?.value ?? 0;
              if (m.name === 'reach') reach = val;
              if (m.name === 'follows') follows = val;
              if (m.name === 'profile_activity') profileActivity = val;
            }
          }

          // Fetch reach breakdown (follower vs non-follower)
          let reachFollowers = 0,
            reachNonFollowers = 0;
          try {
            const breakdownRes = await fetch(
              `https://graph.instagram.com/v25.0/${post.id}/insights?metric=reach&breakdown=follow_type&access_token=${token}`,
            );
            if (breakdownRes.ok) {
              const bd = await breakdownRes.json();
              const results = bd?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
              for (const r of results) {
                const type = r.dimension_values?.[0];
                if (type === 'follower') reachFollowers = r.value || 0;
                if (type === 'non_follower') reachNonFollowers = r.value || 0;
              }
            }
          } catch {
            /* breakdown unavailable */
          }

          await sb.from('post_follow_attribution').upsert(
            {
              brand_ig_id: igUserId,
              post_id: post.id,
              media_type: post.media_type || 'IMAGE',
              posted_at: post.timestamp || new Date().toISOString(),
              caption_preview: (post.caption || '').slice(0, 200),
              permalink: post.permalink || '',
              reach,
              follows,
              profile_activity: profileActivity,
              reach_followers: reachFollowers,
              reach_non_followers: reachNonFollowers,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'brand_ig_id,post_id' },
          );

          synced++;
        } catch {
          // Individual post failed — continue
        }
      }

      results.push({ brand: igUserId, ok: true, posts: synced });
    } catch (e) {
      results.push({
        brand: igUserId,
        ok: false,
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  return json({ ok: true, processed: results.length, results });
};
