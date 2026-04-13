import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabaseConfigured } from '$lib/server/supabase';
import { getChatById } from '$lib/server/chatStore';

export const GET: RequestHandler = async ({ url, params }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) throw error(400, 'missing sub');

  const chatId = params.id;
  if (!chatId) throw error(400, 'missing chat id');

  const chat = await getChatById(chatId, sub);
  if (!chat) throw error(404, 'not found');

  return json({ ok: true, chat });
};
