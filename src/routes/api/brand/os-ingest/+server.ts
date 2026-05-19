import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { buildFingerprint, upsertFingerprints } from '$lib/server/brand/brandOsEngine';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const sb = getServiceSupabase();
  const { data: brand } = await sb
    .from('brand_accounts')
    .select('ig_access_token,ig_followers_count')
    .eq('ig_user_id', igUserId)
    .maybeSingle();
  if (!brand?.ig_access_token) {
    return json({ ok: false, error: 'brand_token_missing' }, { status: 400 });
  }

  const mediaRes = await fetch(
    `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url,media_url&limit=50&access_token=${brand.ig_access_token}`,
  );
  const mediaJson = mediaRes.ok ? await mediaRes.json() : { data: [] };
  const posts: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
    permalink?: string;
    thumbnail_url?: string;
    media_url?: string;
  }> = mediaJson?.data ?? [];

  // Try to fetch insights for each post (business/creator accounts only)
  // Insights give us reach, saves, shares — basic display API doesn't have these
  const insightsMap = new Map<string, { reach: number; saves: number; shares: number }>();
  for (const p of posts) {
    try {
      const insRes = await fetch(
        `https://graph.instagram.com/v25.0/${p.id}/insights?metric=reach,saved,shares&access_token=${brand.ig_access_token}`,
      );
      if (insRes.ok) {
        const insJson = await insRes.json();
        const metrics = insJson?.data ?? [];
        const vals: Record<string, number> = {};
        for (const m of metrics) {
          vals[m.name] = m.values?.[0]?.value ?? 0;
        }
        insightsMap.set(p.id, {
          reach: vals.reach || 0,
          saves: vals.saved || 0,
          shares: vals.shares || 0,
        });
      }
    } catch {
      // Insights not available for this post/account type — continue
    }
  }

  const rows = posts.map((p) => {
    const ins = insightsMap.get(p.id);
    return buildFingerprint({
      brandIgId: igUserId,
      postId: p.id,
      mediaType: p.media_type || 'IMAGE',
      caption: p.caption || '',
      postedAt: p.timestamp || new Date().toISOString(),
      likes: Number(p.like_count || 0),
      comments: Number(p.comments_count || 0),
      saves: ins?.saves || 0,
      shares: ins?.shares || 0,
      reach: ins?.reach || 0,
      followers: Number(brand.ig_followers_count || 0),
    });
  });
  await upsertFingerprints(rows);

  return json({ ok: true, ingested: rows.length, withInsights: insightsMap.size });
};
