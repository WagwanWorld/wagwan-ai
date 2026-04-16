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
