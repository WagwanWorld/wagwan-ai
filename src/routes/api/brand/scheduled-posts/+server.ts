import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const status = url.searchParams.get('status');

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  let apiUrl = `${supabaseUrl}/rest/v1/scheduled_posts?brand_ig_id=eq.${igUserId}&order=scheduled_at.desc.nullsfirst,created_at.desc&limit=50`;
  if (status) {
    apiUrl += `&status=eq.${encodeURIComponent(status)}`;
  }

  const res = await fetch(apiUrl, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw error(500, `Database error: ${errText}`);
  }

  const posts = await res.json();
  return json({ ok: true, posts });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { postId, caption, scheduledAt } = body;
  if (!postId) throw error(400, 'postId required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const updates: Record<string, unknown> = {};
  if (caption !== undefined) updates.caption = caption;
  if (scheduledAt !== undefined) updates.scheduled_at = scheduledAt;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${postId}&brand_ig_id=eq.${encodeURIComponent(igUserId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    },
  );

  if (!res.ok) throw error(500, 'Failed to update post');
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { postId } = body;
  if (!postId) throw error(400, 'postId required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/scheduled_posts?id=eq.${postId}&brand_ig_id=eq.${encodeURIComponent(igUserId)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );

  if (!res.ok) throw error(500, 'Failed to delete post');
  return json({ ok: true });
};
