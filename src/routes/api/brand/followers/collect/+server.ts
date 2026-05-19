import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import {
  fetchFollowerSnapshot,
  fetchAccountReach,
  fetchDemographicBreakdowns,
  fetchOnlineFollowers,
  fetchPostFollowAttribution,
  saveFollowerSnapshot,
  saveDemographicSnapshot,
  saveOnlineActivitySnapshot,
  savePostAttribution,
} from '$lib/server/brand/followerAnalytics';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) return json({ ok: false, error: 'auth_required' }, { status: 401 });

  const sb = getServiceSupabase();
  const { data: brand } = await sb
    .from('brand_accounts')
    .select('ig_access_token,ig_followers_count')
    .eq('ig_user_id', igUserId)
    .maybeSingle();

  const token = brand?.ig_access_token as string;
  if (!token) return json({ ok: false, error: 'no_token' }, { status: 400 });

  const collected: string[] = [];
  const errors: string[] = [];

  // 1. Follower snapshot + reach
  try {
    const profile = await fetchFollowerSnapshot(igUserId, token);
    const reach28d = await fetchAccountReach(igUserId, token, 28);
    await saveFollowerSnapshot(igUserId, { ...profile, reach28d });
    collected.push('followers');

    // Update brand_accounts with latest count
    await sb
      .from('brand_accounts')
      .update({ ig_followers_count: profile.followers })
      .eq('ig_user_id', igUserId);
  } catch (e) {
    errors.push(`followers: ${e instanceof Error ? e.message : 'failed'}`);
  }

  // 2. Demographics (need 100+ followers)
  const followerCount = Number(brand?.ig_followers_count ?? 0);
  if (followerCount >= 100) {
    try {
      const demos = await fetchDemographicBreakdowns(igUserId, token);
      const monday = new Date();
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      await saveDemographicSnapshot(igUserId, monday.toISOString().slice(0, 10), demos);
      collected.push('demographics');
    } catch (e) {
      errors.push(`demographics: ${e instanceof Error ? e.message : 'failed'}`);
    }

    // 3. Online activity heatmap
    try {
      const rawActivity = await fetchOnlineFollowers(igUserId, token);
      const monday = new Date();
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const grid: Array<{ day: number; hour: number; value: number }> = [];
      rawActivity.forEach((entry, dayIdx) => {
        entry.hours.forEach((val, hour) => {
          grid.push({ day: dayIdx, hour, value: val });
        });
      });
      await saveOnlineActivitySnapshot(igUserId, monday.toISOString().slice(0, 10), grid);
      collected.push('activity');
    } catch (e) {
      errors.push(`activity: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  // 4. Post attribution — fetch metadata + insights together
  try {
    const mediaRes = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,media_type,timestamp,caption,permalink&limit=25&access_token=${token}`,
    );
    if (mediaRes.ok) {
      const mediaJson = await mediaRes.json();
      const posts: Array<{
        id: string;
        media_type?: string;
        timestamp?: string;
        caption?: string;
        permalink?: string;
      }> = mediaJson?.data ?? [];
      const postIds = posts.map((p) => p.id);

      if (postIds.length > 0) {
        const attributions = await fetchPostFollowAttribution(igUserId, token, postIds);

        // Merge post metadata with attribution data and save directly
        const postMap = new Map(posts.map((p) => [p.id, p]));
        const rows = attributions.map((a) => {
          const meta = postMap.get(a.postId);
          return {
            brand_ig_id: igUserId,
            post_id: a.postId,
            media_type: meta?.media_type || 'IMAGE',
            posted_at: meta?.timestamp || new Date().toISOString(),
            caption_preview: (meta?.caption || '').slice(0, 200),
            permalink: meta?.permalink || '',
            reach: a.reach,
            follows: a.follows,
            profile_activity: a.profileActivity,
            reach_followers: a.reachFollowers,
            reach_non_followers: a.reachNonFollowers,
            last_synced_at: new Date().toISOString(),
          };
        });

        if (rows.length > 0) {
          await sb
            .from('post_follow_attribution')
            .upsert(rows, { onConflict: 'brand_ig_id,post_id' });
        }
        collected.push(`posts(${rows.length})`);
      }
    }
  } catch (e) {
    errors.push(`posts: ${e instanceof Error ? e.message : 'failed'}`);
  }

  return json({ ok: true, collected, errors: errors.length ? errors : undefined });
};
