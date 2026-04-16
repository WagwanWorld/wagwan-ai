import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { publishPost } from '$lib/server/marketplace/instagramPublisher';
import pg from 'pg';

export const GET: RequestHandler = async ({ request }) => {
  // Verify cron secret (Vercel sets this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

  try {
    // Find posts due for publishing
    const { rows: duePosts } = await pool.query(
      `SELECT sp.*, ba.ig_access_token
       FROM scheduled_posts sp
       JOIN brand_accounts ba ON ba.ig_user_id = sp.brand_ig_id
       WHERE sp.status = 'scheduled'
         AND sp.scheduled_at <= now()
       ORDER BY sp.scheduled_at ASC
       LIMIT 5`,
    );

    const results = [];

    for (const post of duePosts) {
      // Mark as publishing
      await pool.query(`UPDATE scheduled_posts SET status = 'publishing' WHERE id = $1`, [post.id]);

      // Fetch carousel items if needed
      let carouselItems;
      if (post.media_type === 'CAROUSEL') {
        const { rows } = await pool.query(
          `SELECT gcs_url, media_type FROM scheduled_post_carousel_items WHERE post_id = $1 ORDER BY position`,
          [post.id],
        );
        carouselItems = rows.map((r: { gcs_url: string; media_type: string }) => ({
          url: r.gcs_url,
          mediaType: r.media_type as 'IMAGE' | 'VIDEO',
        }));
      }

      const caption = [post.caption, ...(post.hashtags || []).map((h: string) => `#${h}`)].filter(Boolean).join('\n\n');

      const result = await publishPost(post.brand_ig_id, post.ig_access_token, {
        gcsUrl: post.gcs_url,
        mediaType: post.media_type,
        caption,
        altText: post.alt_text || undefined,
        carouselItems,
      });

      if (result.success) {
        await pool.query(
          `UPDATE scheduled_posts SET status = 'published', published_at = now(), ig_media_id = $2, ig_permalink = $3 WHERE id = $1`,
          [post.id, result.igMediaId, result.permalink],
        );
        results.push({ id: post.id, status: 'published' });
      } else {
        await pool.query(
          `UPDATE scheduled_posts SET status = 'failed', error_message = $2 WHERE id = $1`,
          [post.id, result.error],
        );
        results.push({ id: post.id, status: 'failed', error: result.error });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } finally {
    await pool.end();
  }
};
