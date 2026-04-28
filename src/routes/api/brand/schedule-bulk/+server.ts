import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { posts, cadence } = body as {
    posts: Array<{
      gcsUrl: string;
      mediaType: string;
      caption: string;
      hashtags: string[];
      altText?: string;
      mentions?: string[];
      location?: string;
      carouselItems?: Array<{ gcsUrl: string; mediaType: string; position: number }>;
    }>;
    cadence: {
      frequency: 'daily' | 'twice_daily' | 'every_2_days' | 'custom';
      startDate: string;
      time: string;
      timezone: string;
      customIntervalHours?: number;
    };
  };

  if (!posts?.length) throw error(400, 'No posts provided');
  if (!cadence) throw error(400, 'Cadence config required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const intervalMs = {
    daily: 24 * 60 * 60 * 1000,
    twice_daily: 12 * 60 * 60 * 1000,
    every_2_days: 48 * 60 * 60 * 1000,
    custom: (cadence.customIntervalHours || 24) * 60 * 60 * 1000,
  }[cadence.frequency];

  const startIso = `${cadence.startDate}T${cadence.time}:00`;
  const scheduled = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const offsetMs = i * intervalMs;
    const baseDate = new Date(startIso);
    const scheduledAt = new Date(baseDate.getTime() + offsetMs).toISOString();

    const postRes = await fetch(`${supabaseUrl}/rest/v1/scheduled_posts`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        brand_ig_id: igUserId,
        gcs_url: post.gcsUrl,
        media_type: post.mediaType,
        caption: post.caption,
        hashtags: post.hashtags,
        alt_text: post.altText || '',
        scheduled_at: scheduledAt,
        status: 'scheduled',
        ai_reasoning: `Bulk cadence: ${cadence.frequency}, position ${i + 1} of ${posts.length}`,
      }),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      throw error(500, `Database error: ${errText}`);
    }

    const [inserted] = await postRes.json();

    if (post.carouselItems?.length) {
      for (const item of post.carouselItems) {
        await fetch(`${supabaseUrl}/rest/v1/scheduled_post_carousel_items`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_id: inserted.id,
            gcs_url: item.gcsUrl,
            media_type: item.mediaType,
            position: item.position,
          }),
        });
      }
    }

    scheduled.push({
      postId: inserted.id,
      scheduledAt,
      gcsUrl: post.gcsUrl,
      caption: post.caption,
    });

    await fetch(`${supabaseUrl}/rest/v1/content_activity_log`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_ig_id: igUserId,
        event_type: 'scheduled',
        event_data: { postId: inserted.id, scheduledAt, cadence: cadence.frequency },
      }),
    });
  }

  return json({ ok: true, scheduled });
};
