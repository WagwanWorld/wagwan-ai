import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { publishPost } from '$lib/server/marketplace/instagramPublisher';

export const GET: RequestHandler = async ({ request }) => {
  // Verify cron secret (Vercel sets this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Find posts due for publishing
  const duePostsRes = await fetch(
    `${supabaseUrl}/rest/v1/scheduled_posts?status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(new Date().toISOString())}&order=scheduled_at.asc&limit=5`,
    {
      headers: {
        apikey: supabaseKey!,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );

  if (!duePostsRes.ok) {
    return json({ error: 'Failed to fetch due posts' }, { status: 500 });
  }

  const duePosts: Array<Record<string, unknown>> = await duePostsRes.json();

  const results = [];

  for (const post of duePosts) {
    // Fetch brand token for this post
    const brandRes = await fetch(
      `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${post.brand_ig_id}&select=ig_access_token&limit=1`,
      {
        headers: {
          apikey: supabaseKey!,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    );

    const brandRows = brandRes.ok ? await brandRes.json() : [];
    const brandAccount = brandRows[0];
    if (!brandAccount) {
      results.push({ id: post.id, status: 'failed', error: 'Brand account not found' });
      continue;
    }

    const igAccessToken = brandAccount.ig_access_token as string;

    // Mark as publishing
    await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${post.id}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey!,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'publishing' }),
    });

    // Fetch carousel items if needed
    let carouselItems: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO' }> | undefined;
    if (post.media_type === 'CAROUSEL') {
      const carouselRes = await fetch(
        `${supabaseUrl}/rest/v1/scheduled_post_carousel_items?post_id=eq.${post.id}&select=gcs_url,media_type&order=position.asc`,
        {
          headers: {
            apikey: supabaseKey!,
            Authorization: `Bearer ${supabaseKey}`,
          },
        },
      );

      const carouselRows: Array<{ gcs_url: string; media_type: string }> = carouselRes.ok
        ? await carouselRes.json()
        : [];

      carouselItems = carouselRows.map((r) => ({
        url: r.gcs_url,
        mediaType: r.media_type as 'IMAGE' | 'VIDEO',
      }));
    }

    const caption = [post.caption, ...((post.hashtags as string[]) || []).map((h: string) => `#${h}`)].filter(Boolean).join('\n\n');

    const result = await publishPost(post.brand_ig_id as string, igAccessToken, {
      gcsUrl: post.gcs_url as string,
      mediaType: post.media_type as string,
      caption,
      altText: (post.alt_text as string) || undefined,
      carouselItems,
    });

    if (result.success) {
      await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${post.id}`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey!,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'published',
          published_at: new Date().toISOString(),
          ig_media_id: result.igMediaId,
          ig_permalink: result.permalink,
        }),
      });
      results.push({ id: post.id, status: 'published' });
    } else {
      await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${post.id}`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey!,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'failed',
          error_message: result.error,
        }),
      });
      results.push({ id: post.id, status: 'failed', error: result.error });
    }
  }

  return json({ ok: true, processed: results.length, results });
};
