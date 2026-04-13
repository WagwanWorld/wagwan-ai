import {
  getServiceSupabase,
  getProfile,
  isSupabaseConfigured,
  upsertProfile,
} from '$lib/server/supabase';
import {
  AGENT_LABELS,
  AGENT_TYPES,
  type AgentType,
  isAgentType as isAgentTypeConst,
} from '$lib/chats/agentConstants';

export { AGENT_TYPES, AGENT_LABELS, type AgentType };

export interface ChatRow {
  id: string;
  google_sub: string;
  agent_type: AgentType;
  title: string;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface ChatRowWithPreview extends ChatRow {
  last_preview: string;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  sender_type: 'user' | 'agent' | 'system';
  content: string;
  message_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function startOfUtcDay(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)).toISOString();
}

export function isAgentType(s: string): s is AgentType {
  return isAgentTypeConst(s);
}

/** Ensures `user_profiles` has a row so `chats.google_sub` FK inserts succeed. */
export async function ensureUserProfileRow(googleSub: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !googleSub.trim()) return false;
  const sub = googleSub.trim();
  const row = await getProfile(sub);
  if (row) return true;
  const ok = await upsertProfile(sub, {});
  if (!ok) console.error('[chatStore] ensureUserProfileRow: upsertProfile failed');
  return ok;
}

export async function ensureChat(googleSub: string, agentType: AgentType): Promise<ChatRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getServiceSupabase();
  const title = AGENT_LABELS[agentType];

  const { data: existing } = await supabase
    .from('chats')
    .select('*')
    .eq('google_sub', googleSub)
    .eq('agent_type', agentType)
    .maybeSingle();

  if (existing) return existing as ChatRow;

  const { data: created, error } = await supabase
    .from('chats')
    .insert({
      google_sub: googleSub,
      agent_type: agentType,
      title,
      unread_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[chatStore] ensureChat insert:', error.message);
    return null;
  }
  return created as ChatRow;
}

/** Creates any missing agent threads for this user. */
export async function ensureAllChats(googleSub: string): Promise<ChatRow[]> {
  if (!isSupabaseConfigured()) return [];
  const profileOk = await ensureUserProfileRow(googleSub);
  if (!profileOk) return [];

  const rows: ChatRow[] = [];
  for (const agentType of AGENT_TYPES) {
    const row = await ensureChat(googleSub, agentType);
    if (row) rows.push(row);
  }
  return rows;
}

export async function getChatById(chatId: string, googleSub: string): Promise<ChatRow | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getServiceSupabase()
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .eq('google_sub', googleSub)
    .maybeSingle();

  if (error) {
    console.error('[chatStore] getChatById:', error.message);
    return null;
  }
  return data as ChatRow | null;
}

export async function listChats(googleSub: string): Promise<ChatRow[]> {
  if (!isSupabaseConfigured()) return [];
  await ensureAllChats(googleSub);
  const { data, error } = await getServiceSupabase()
    .from('chats')
    .select('*')
    .eq('google_sub', googleSub)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[chatStore] listChats:', error.message);
    return [];
  }
  return (data ?? []) as ChatRow[];
}

async function lastMessagePreview(chatId: string): Promise<string> {
  const { data } = await getServiceSupabase()
    .from('messages')
    .select('content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const t = (data?.content as string | undefined)?.trim() ?? '';
  return t.length > 90 ? `${t.slice(0, 88)}…` : t;
}

export async function listChatsWithPreview(googleSub: string): Promise<ChatRowWithPreview[]> {
  const chats = await listChats(googleSub);
  const enriched = await Promise.all(
    chats.map(async c => ({
      ...c,
      last_preview: await lastMessagePreview(c.id),
    })),
  );
  return enriched.sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
}

export type ListChatsApiResult = {
  chats: ChatRowWithPreview[];
  warning?: string;
  hint?: string;
};

/** Same as list flow for GET /api/chats; adds diagnostics when no threads exist after ensure. */
export async function listChatsWithPreviewForApi(googleSub: string): Promise<ListChatsApiResult> {
  const chats = await listChatsWithPreview(googleSub);
  if (chats.length === 0) {
    return {
      chats,
      warning: 'chats_unavailable',
      hint:
        'No agent threads returned. Run supabase/migration.sql, 002_identity_graph.sql, and 003_multi_agent_chats.sql in the Supabase SQL Editor (in that order), or set SUPABASE_DB_URL and run npm run supabase:migrate. Confirm SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. Tap “Set up my chats” to retry after fixing.',
    };
  }
  return { chats };
}

const LEGACY_IMPORT_FLAG = 'twinLegacyImportedAt';

export async function maybeImportLegacyTwinThread(googleSub: string, chatId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getServiceSupabase();

  const { data: state } = await supabase
    .from('agent_states')
    .select('extra')
    .eq('google_sub', googleSub)
    .eq('agent_type', 'twin')
    .maybeSingle();

  const extra = (state?.extra as Record<string, unknown>) ?? {};
  if (extra[LEGACY_IMPORT_FLAG]) return;

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId);

  if ((count ?? 0) > 0) {
    await supabase.from('agent_states').upsert(
      {
        google_sub: googleSub,
        agent_type: 'twin',
        extra: { ...extra, [LEGACY_IMPORT_FLAG]: new Date().toISOString(), reason: 'already_had_messages' },
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'google_sub,agent_type' },
    );
    return;
  }

  const profile = await getProfile(googleSub);
  const thread = profile?.profile_data?.twinChatThread as
    | { messages?: Array<{ role: string; text?: string; at?: string; cardRefs?: unknown[] }> }
    | undefined;
  const legacyMessages = thread?.messages;
  if (!Array.isArray(legacyMessages) || !legacyMessages.length) {
    await supabase.from('agent_states').upsert(
      {
        google_sub: googleSub,
        agent_type: 'twin',
        extra: { ...extra, [LEGACY_IMPORT_FLAG]: new Date().toISOString(), reason: 'no_legacy' },
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'google_sub,agent_type' },
    );
    return;
  }

  const inserts = legacyMessages
    .filter(m => m.text?.trim())
    .map(m => ({
      chat_id: chatId,
      sender_type: m.role === 'user' ? 'user' : 'agent',
      content: (m.text ?? '').slice(0, 50_000),
      message_type: 'text',
      metadata: m.at ? { at: m.at, legacyImport: true } : { legacyImport: true },
    }));

  if (inserts.length) {
    const { error } = await supabase.from('messages').insert(inserts);
    if (error) {
      console.error('[chatStore] legacy twin import:', error.message);
      return;
    }

    const last = legacyMessages.filter(m => m.text?.trim()).pop();
    await supabase
      .from('chats')
      .update({
        last_message_at: last?.at ?? new Date().toISOString(),
        unread_count: 0,
      })
      .eq('id', chatId);
  }

  await supabase.from('agent_states').upsert(
    {
      google_sub: googleSub,
      agent_type: 'twin',
      extra: { ...extra, [LEGACY_IMPORT_FLAG]: new Date().toISOString(), importedCount: inserts.length },
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'google_sub,agent_type' },
  );
}

export async function listMessages(
  chatId: string,
  googleSub: string,
  opts?: { limit?: number; before?: string },
): Promise<MessageRow[]> {
  if (!isSupabaseConfigured()) return [];
  const chat = await getChatById(chatId, googleSub);
  if (!chat) return [];

  if (chat.agent_type === 'twin') {
    await maybeImportLegacyTwinThread(googleSub, chatId);
  }

  const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 200);
  let q = getServiceSupabase()
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts?.before) {
    q = q.lt('created_at', opts.before);
  }

  const { data, error } = await q;

  if (error) {
    console.error('[chatStore] listMessages:', error.message);
    return [];
  }
  const rows = (data ?? []) as MessageRow[];
  return rows.reverse();
}

export async function appendMessage(
  chatId: string,
  googleSub: string,
  row: {
    sender_type: 'user' | 'agent' | 'system';
    content: string;
    message_type?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<MessageRow | null> {
  if (!isSupabaseConfigured()) return null;
  const chat = await getChatById(chatId, googleSub);
  if (!chat) return null;

  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_type: row.sender_type,
      content: row.content,
      message_type: row.message_type ?? 'text',
      metadata: row.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error('[chatStore] appendMessage:', error.message);
    return null;
  }

  const nextUnread =
    row.sender_type === 'user'
      ? 0
      : row.sender_type === 'agent' || row.sender_type === 'system'
        ? chat.unread_count + 1
        : chat.unread_count;

  await supabase
    .from('chats')
    .update({
      last_message_at: now,
      unread_count: nextUnread,
    })
    .eq('id', chatId);

  return data as MessageRow;
}

export async function markChatRead(chatId: string, googleSub: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const chat = await getChatById(chatId, googleSub);
  if (!chat) return;
  await getServiceSupabase().from('chats').update({ unread_count: 0 }).eq('id', chatId);
}

export async function countProactiveMessagesToday(googleSub: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const since = startOfUtcDay();
  const supabase = getServiceSupabase();

  const { data: chats } = await supabase.from('chats').select('id').eq('google_sub', googleSub);
  const chatIds = (chats ?? []).map(c => c.id as string);
  if (!chatIds.length) return 0;

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('chat_id', chatIds)
    .gte('created_at', since)
    .eq('sender_type', 'agent')
    .contains('metadata', { proactive: true });

  if (error) {
    console.error('[chatStore] countProactiveMessagesToday:', error.message);
    return 0;
  }
  return count ?? 0;
}
