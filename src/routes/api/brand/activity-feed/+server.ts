import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 100);

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/content_activity_log?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=created_at.desc&limit=${limit}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw error(500, `Database error: ${errText}`);
  }

  const events = await res.json();
  return json({ ok: true, events });
};
