import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTokens, isSupabaseConfigured } from '$lib/server/supabase';
import { fetchInstagramHomeSnapshot } from '$lib/server/instagram';

/** Live IG snapshot for home: top 3 posts, metrics, recent comments. Requires Supabase-stored token. */
export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured', snapshot: null });
  }

  let body: { googleSub?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!googleSub) throw error(400, 'googleSub required');

  const { instagramToken } = await getTokens(googleSub);
  if (!instagramToken) {
    return json({ ok: true, snapshot: null });
  }

  const snapshot = await fetchInstagramHomeSnapshot(instagramToken);
  return json({ ok: true, snapshot });
};
