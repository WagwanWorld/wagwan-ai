import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { ingestCommentIntelligence } from '$lib/server/brand/brandOsEngine';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');
  const sb = getServiceSupabase();
  const { data: brand } = await sb
    .from('brand_accounts')
    .select('ig_access_token')
    .eq('ig_user_id', igUserId)
    .maybeSingle();
  if (!brand?.ig_access_token) {
    return json({ ok: false, error: 'brand_token_missing' }, { status: 400 });
  }

  const mediaRes = await fetch(
    `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id&limit=12&access_token=${brand.ig_access_token}`,
  );
  const mediaJson = mediaRes.ok ? await mediaRes.json() : { data: [] };
  const media: Array<{ id: string }> = mediaJson?.data ?? [];

  const comments: Array<{ postId: string; text: string }> = [];
  for (const m of media) {
    const commentRes = await fetch(
      `https://graph.instagram.com/v25.0/${m.id}/comments?fields=text&limit=50&access_token=${brand.ig_access_token}`,
    );
    if (!commentRes.ok) continue;
    const commentJson = await commentRes.json().catch(() => ({ data: [] }));
    for (const c of commentJson?.data ?? []) {
      if (typeof c.text === 'string' && c.text.trim()) {
        comments.push({ postId: m.id, text: c.text.trim() });
      }
    }
  }

  const clusters = await ingestCommentIntelligence(igUserId, comments);
  return json({ ok: true, comments: comments.length, clusters: clusters.length });
};
