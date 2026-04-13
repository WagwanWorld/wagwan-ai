import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabaseConfigured } from '$lib/server/supabase';
import { listMessages, markChatRead } from '$lib/server/chatStore';

export const GET: RequestHandler = async ({ url, params }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) throw error(400, 'missing sub');

  const chatId = params.id;
  if (!chatId) throw error(400, 'missing chat id');

  const limit = Math.min(Number(url.searchParams.get('limit')) || 80, 200);
  const before = url.searchParams.get('before') ?? undefined;

  const messages = await listMessages(chatId, sub, { limit, before });
  const markRead = url.searchParams.get('markRead') === '1';
  if (markRead) await markChatRead(chatId, sub);

  return json({ ok: true, messages });
};
