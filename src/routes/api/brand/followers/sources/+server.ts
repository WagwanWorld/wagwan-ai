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
    .select(
      'post_id,media_type,posted_at,caption_preview,permalink,reach,follows,profile_activity,reach_followers,reach_non_followers',
    )
    .eq('brand_ig_id', igUserId)
    .gte('posted_at', since)
    .order('follows', { ascending: false })
    .limit(25);

  const posts = (rows ?? []).map((r) => ({
    postId: r.post_id,
    mediaType: r.media_type || 'IMAGE',
    postedAt: r.posted_at,
    captionPreview: r.caption_preview || '',
    permalink: r.permalink || '',
    reach: r.reach || 0,
    follows: r.follows || 0,
    profileActivity: r.profile_activity || 0,
    reachFollowers: r.reach_followers || 0,
    reachNonFollowers: r.reach_non_followers || 0,
    conversionRate:
      r.reach_non_followers > 0 ? Math.round((r.follows / r.reach_non_followers) * 10000) / 100 : 0,
  }));

  return json({ ok: true, range: `${days}d`, posts });
};
