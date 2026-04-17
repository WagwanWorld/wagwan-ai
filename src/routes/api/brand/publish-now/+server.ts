import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { publishPost } from '$lib/server/marketplace/instagramPublisher';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw error(500, 'Not configured');

  const body = await request.json();
  const { postId } = body as { postId: string };
  if (!postId) throw error(400, 'postId required');

  // Get the post
  const postRes = await fetch(
    `${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${encodeURIComponent(postId)}&brand_ig_id=eq.${encodeURIComponent(igUserId)}&select=*&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const posts = await postRes.json();
  if (!posts.length) throw error(404, 'Post not found');
  const post = posts[0];

  // Get brand token
  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&select=ig_access_token&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const brands = await brandRes.json();
  if (!brands.length) throw error(404, 'Brand not found');
  const token = brands[0].ig_access_token;

  // Mark as publishing
  await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'publishing' }),
  });

  // Fetch carousel items if needed
  let carouselItems;
  if (post.media_type === 'CAROUSEL') {
    const ciRes = await fetch(
      `${supabaseUrl}/rest/v1/scheduled_post_carousel_items?post_id=eq.${postId}&order=position.asc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const ciRows = await ciRes.json();
    carouselItems = ciRows.map((r: { gcs_url: string; media_type: string }) => ({
      url: r.gcs_url,
      mediaType: r.media_type as 'IMAGE' | 'VIDEO',
    }));
  }

  const caption = [post.caption, ...((post.hashtags as string[]) || []).map((h: string) => `#${h}`)].filter(Boolean).join('\n\n');

  const result = await publishPost(igUserId, token, {
    gcsUrl: post.gcs_url,
    mediaType: post.media_type,
    caption,
    altText: post.alt_text || undefined,
    carouselItems,
  });

  if (result.success) {
    await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${postId}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'published',
        published_at: new Date().toISOString(),
        ig_media_id: result.igMediaId,
        ig_permalink: result.permalink,
      }),
    });
    return json({ ok: true, igMediaId: result.igMediaId, permalink: result.permalink });
  } else {
    await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${postId}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed', error_message: result.error }),
    });
    return json({ ok: false, error: result.error }, { status: 500 });
  }
};
