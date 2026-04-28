import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { publishPost } from '$lib/server/marketplace/instagramPublisher';
import { refreshBrandToken } from '$lib/server/marketplace/brandInstagram';

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  // Find ALL posts due for publishing (no limit)
  const duePostsRes = await fetch(
    `${supabaseUrl}/rest/v1/scheduled_posts?status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(new Date().toISOString())}&order=scheduled_at.asc`,
    { headers },
  );

  if (!duePostsRes.ok) {
    return json({ error: 'Failed to fetch due posts' }, { status: 500 });
  }

  const duePosts: Array<Record<string, unknown>> = await duePostsRes.json();
  const results = [];

  // Cache brand tokens to avoid repeated lookups
  const brandTokenCache = new Map<string, string>();

  for (const post of duePosts) {
    const brandIgId = post.brand_ig_id as string;

    if (!brandTokenCache.has(brandIgId)) {
      const brandRes = await fetch(
        `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}&select=ig_access_token,token_expires_at&limit=1`,
        { headers },
      );
      const brandRows = brandRes.ok ? await brandRes.json() : [];
      const brandAccount = brandRows[0];

      if (!brandAccount) {
        results.push({ id: post.id, status: 'failed', error: 'Brand account not found' });
        await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            brand_ig_id: brandIgId,
            event_type: 'failed',
            event_data: { postId: post.id, error: 'Brand account not found' },
          }),
        });
        continue;
      }

      let token = brandAccount.ig_access_token as string;

      // Refresh token if expiring within 7 days
      if (brandAccount.token_expires_at) {
        const expiresAt = new Date(brandAccount.token_expires_at as string);
        const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (expiresAt < sevenDaysFromNow) {
          try {
            const refreshed = await refreshBrandToken(token);
            token = refreshed.token;
            await fetch(`${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                ig_access_token: refreshed.token,
                token_expires_at: refreshed.expiresAt.toISOString(),
              }),
            });
          } catch (e) {
            await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                brand_ig_id: brandIgId,
                event_type: 'failed',
                event_data: { error: 'Token refresh failed', detail: e instanceof Error ? e.message : 'unknown' },
              }),
            });
          }
        }
      }

      brandTokenCache.set(brandIgId, token);
    }

    const igAccessToken = brandTokenCache.get(brandIgId)!;

    await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${post.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'publishing' }),
    });

    let carouselItems: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO' }> | undefined;
    if (post.media_type === 'CAROUSEL') {
      const carouselRes = await fetch(
        `${supabaseUrl}/rest/v1/scheduled_post_carousel_items?post_id=eq.${post.id}&select=gcs_url,media_type&order=position.asc`,
        { headers },
      );
      const carouselRows: Array<{ gcs_url: string; media_type: string }> = carouselRes.ok ? await carouselRes.json() : [];
      carouselItems = carouselRows.map((r) => ({ url: r.gcs_url, mediaType: r.media_type as 'IMAGE' | 'VIDEO' }));
    }

    const caption = [post.caption, ...((post.hashtags as string[]) || []).map((h: string) => `#${h}`)].filter(Boolean).join('\n\n');

    const result = await publishPost(brandIgId, igAccessToken, {
      gcsUrl: post.gcs_url as string,
      mediaType: post.media_type as 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL',
      caption,
      altText: (post.alt_text as string) || undefined,
      carouselItems,
    });

    if (result.success) {
      await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${post.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'published',
          published_at: new Date().toISOString(),
          ig_media_id: result.igMediaId,
          ig_permalink: result.permalink,
        }),
      });
      await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brand_ig_id: brandIgId,
          event_type: 'published',
          event_data: { postId: post.id, igMediaId: result.igMediaId, permalink: result.permalink },
        }),
      });
      results.push({ id: post.id, status: 'published' });
    } else {
      await fetch(`${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${post.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'failed', error_message: result.error }),
      });
      await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brand_ig_id: brandIgId,
          event_type: 'failed',
          event_data: { postId: post.id, error: result.error },
        }),
      });
      results.push({ id: post.id, status: 'failed', error: result.error });
    }
  }

  return json({ ok: true, processed: results.length, results });
};
