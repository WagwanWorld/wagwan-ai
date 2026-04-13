import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabaseConfigured } from '$lib/server/supabase';
import {
  ensureUserProfileRow,
  ensureChat,
  ensureAllChats,
  listChatsWithPreviewForApi,
} from '$lib/server/chatStore';
import { isAgentType, type AgentType } from '$lib/chats/agentConstants';

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) throw error(400, 'missing sub');

  const { chats, warning, hint } = await listChatsWithPreviewForApi(sub);
  return json({
    ok: true,
    chats,
    ...(warning ? { warning, hint } : {}),
  });
};

/**
 * Bootstrap chat threads in Supabase.
 * Body: `{ sub: string, agent?: AgentType }`
 * - With `agent`: ensure that single thread (idempotent).
 * - Without `agent`: ensure one row per agent type for this user.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: { sub?: string; agent?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'invalid json');
  }

  const sub = body.sub?.trim();
  if (!sub) throw error(400, 'missing sub');

  const profileOk = await ensureUserProfileRow(sub);
  if (!profileOk) {
    return json(
      {
        ok: false,
        error: 'profile_upsert_failed',
        hint: 'Could not create or update user_profiles. Check SUPABASE_URL, service role key, and that migration.sql has run.',
      },
      { status: 500 },
    );
  }

  const agentRaw = body.agent?.trim();
  if (agentRaw && isAgentType(agentRaw)) {
    const agent = agentRaw as AgentType;
    const chat = await ensureChat(sub, agent);
    if (!chat) {
      const { hint } = await listChatsWithPreviewForApi(sub);
      return json(
        {
          ok: false,
          error: 'chat_create_failed',
          hint:
            hint ??
            'Could not insert into chats. Run supabase/003_multi_agent_chats.sql after migration.sql.',
        },
        { status: 500 },
      );
    }
    return json({ ok: true, chat });
  }

  const chats = await ensureAllChats(sub);
  if (!chats.length) {
    const { hint } = await listChatsWithPreviewForApi(sub);
    return json(
      {
        ok: false,
        error: 'chats_unavailable',
        hint:
          hint ??
          'No threads created. Run supabase/003_multi_agent_chats.sql. Confirm user_profiles row exists for this google_sub.',
      },
      { status: 500 },
    );
  }

  return json({ ok: true, chats });
};
