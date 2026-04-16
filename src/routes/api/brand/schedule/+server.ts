import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import pg from 'pg';

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

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    const insertedIds = [];

    for (const post of posts) {
      const { rows: [inserted] } = await pool.query(
        `INSERT INTO scheduled_posts (brand_ig_id, gcs_url, media_type, caption, hashtags, alt_text, scheduled_at, status, ai_reasoning)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8)
         RETURNING id`,
        [igUserId, post.gcsUrl, post.mediaType, post.caption, post.hashtags, post.altText || '', post.scheduledAt, post.aiReasoning || ''],
      );

      if (post.carouselItems?.length) {
        for (const item of post.carouselItems) {
          await pool.query(
            `INSERT INTO scheduled_post_carousel_items (post_id, gcs_url, media_type, position) VALUES ($1, $2, $3, $4)`,
            [inserted.id, item.gcsUrl, item.mediaType, item.position],
          );
        }
      }

      insertedIds.push(inserted.id);
    }

    return json({ ok: true, scheduledCount: insertedIds.length, ids: insertedIds });
  } finally {
    await pool.end();
  }
};
