import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { listCreatorBrandSignals, markSignalsSeen } from '$lib/server/creatorSignals';
import { authenticateCreatorRequest } from '$lib/server/creatorAuth';
import type { SignalType } from '$lib/types/creator-signals';

export const GET: RequestHandler = async ({ request, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sb = getServiceSupabase();
  const creator = await authenticateCreatorRequest(request, sb);
  if (!creator.ok) {
    return json({ ok: false, error: creator.error }, { status: creator.status });
  }

  const seenParam = url.searchParams.get('seen');
  const signalType = url.searchParams.get('signal_type') as SignalType | null;

  const seen = seenParam === 'true' ? true : seenParam === 'false' ? false : undefined;

  const { signals, unseenCount } = await listCreatorBrandSignals(sb, creator.googleSub, {
    seen,
    signalType: signalType ?? undefined,
  });

  // Strip creator_google_sub from response
  const views = signals.map(({ creator_google_sub: _sub, ...rest }) => rest);

  return json({ ok: true, signals: views, unseenCount });
};

export const PATCH: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();

  const id = typeof body.id === 'string' ? body.id.trim() : undefined;
  const markAllSeen = body.markAllSeen === true;

  if (!id && !markAllSeen) {
    throw error(400, 'Provide id or markAllSeen');
  }

  const sb = getServiceSupabase();
  const creator = await authenticateCreatorRequest(request, sb);
  if (!creator.ok) {
    return json({ ok: false, error: creator.error }, { status: creator.status });
  }

  const ok = await markSignalsSeen(sb, creator.googleSub, { id, markAllSeen });

  return json({ ok });
};
