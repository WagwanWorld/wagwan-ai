import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabaseConfigured } from '$lib/server/supabase';
import {
  appendMessage,
  getChatById,
  listMessages,
} from '$lib/server/chatStore';
import { runAgentTurn } from '$lib/server/agents/runtime';
import type { LearnedMemory } from '$lib/server/ai';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: {
    googleSub?: string;
    chatId?: string;
    message?: string;
    profile?: Record<string, unknown>;
    twinMemory?: LearnedMemory;
  };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'invalid json');
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!googleSub || !chatId || !message) throw error(400, 'googleSub, chatId, and message required');

  const chat = await getChatById(chatId, googleSub);
  if (!chat) throw error(404, 'chat not found');

  const userRow = await appendMessage(chatId, googleSub, {
    sender_type: 'user',
    content: message,
    message_type: 'text',
  });
  if (!userRow) throw error(500, 'failed to save message');

  const prior = await listMessages(chatId, googleSub, { limit: 40 });

  let result;
  try {
    result = await runAgentTurn({
      agent: chat.agent_type,
      googleSub,
      userMessage: message,
      priorMessages: prior,
      twinMemory: body.twinMemory,
      profile: body.profile,
    });
  } catch (e) {
    console.error('[agent/chat] runAgentTurn:', e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : 'agent_failed';
    return json(
      { ok: false, error: msg.includes('401') ? 'AI key invalid or expired.' : msg.slice(0, 240) },
      { status: 502 },
    );
  }

  const agentRow = await appendMessage(chatId, googleSub, {
    sender_type: 'agent',
    content: result.content,
    message_type: result.message_type,
    metadata: result.metadata,
  });
  if (!agentRow) throw error(500, 'failed to save reply');

  return json({
    ok: true,
    message: {
      content: result.content,
      message_type: result.message_type,
      metadata: result.metadata,
      id: agentRow.id,
      created_at: agentRow.created_at,
    },
  });
};
