import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { posts } = body as {
    posts: Array<{
      gcsUrl: string;
      mediaType: string;
      caption: string;
      hashtags: string[];
      altText?: string;
      scheduledAt: string;
      aiReasoning?: string;
      carouselItems?: Array<{ gcsUrl: string; mediaType: string; position: number }>;
    }>;
  };

  if (!posts?.length) throw error(400, 'No posts to schedule');

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const insertedIds = [];

  for (const post of posts) {
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
        scheduled_at: post.scheduledAt,
        status: 'scheduled',
        ai_reasoning: post.aiReasoning || '',
      }),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      throw error(500, `Database error inserting post: ${errText}`);
    }

    const [inserted] = await postRes.json();

    if (post.carouselItems?.length) {
      for (const item of post.carouselItems) {
        const carouselRes = await fetch(`${supabaseUrl}/rest/v1/scheduled_post_carousel_items`, {
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

        if (!carouselRes.ok) {
          const errText = await carouselRes.text();
          throw error(500, `Database error inserting carousel item: ${errText}`);
        }
      }
    }

    insertedIds.push(inserted.id);
  }

  return json({ ok: true, scheduledCount: insertedIds.length, ids: insertedIds });
};
