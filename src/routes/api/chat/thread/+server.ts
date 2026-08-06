/**
 * Persist twin chat thread in Supabase profile_data.twinChatThread (merged; survives full profile saves).
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfile, updateProfileData, isSupabaseConfigured } from '$lib/server/supabase';
import { assertCreatorProfileFromRequest } from '$lib/server/creatorAuth';

const THREAD_KEY = 'twinChatThread';
const MAX_THREAD_JSON_BYTES = 480_000;

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export const GET: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const { googleSub } = await assertCreatorProfileFromRequest(request);

  const row = await getProfile(googleSub);
  if (!row) {
    return json({ ok: true, thread: null });
  }

  const thread = row.profile_data[THREAD_KEY];
  return json({
    ok: true,
    thread: thread ?? null,
    profileUpdatedAt: row.updated_at,
  });
};

export const PUT: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const { googleSub } = await assertCreatorProfileFromRequest(request);

  let body: { thread?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'invalid json');
  }

  const thread = body.thread;
  if (thread == null || typeof thread !== 'object') {
    throw error(400, 'missing thread');
  }

  const raw = JSON.stringify(thread);
  if (byteLength(raw) > MAX_THREAD_JSON_BYTES) {
    throw error(413, 'thread too large');
  }

  const t = thread as { messages?: unknown; version?: unknown; updatedAt?: unknown };
  if (!Array.isArray(t.messages)) {
    throw error(400, 'invalid thread.messages');
  }

  const ok = await updateProfileData(googleSub, { [THREAD_KEY]: thread });
  if (!ok) {
    return json({ ok: false, error: 'save_failed' }, { status: 500 });
  }

  return json({ ok: true });
};
