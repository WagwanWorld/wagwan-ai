import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { listCreatorBrandSignals, markSignalsSeen } from '$lib/server/creatorSignals';
import type { SignalType } from '$lib/types/creator-signals';
import { getAuthenticatedCreator } from '$lib/server/creatorAuth';

export const GET: RequestHandler = async ({ request, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const creator = await getAuthenticatedCreator(request);
  if (!creator.ok) {
    return json({ ok: false, error: creator.error }, { status: creator.status });
  }

  const requestedSub = url.searchParams.get('googleSub')?.trim();
  if (requestedSub && requestedSub !== creator.googleSub) {
    throw error(403, 'Cannot access another creator');
  }

  const seenParam = url.searchParams.get('seen');
  const signalType = url.searchParams.get('signal_type') as SignalType | null;

  const seen = seenParam === 'true' ? true : seenParam === 'false' ? false : undefined;

  const sb = getServiceSupabase();
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
  const creator = await getAuthenticatedCreator(request);
  if (!creator.ok) {
    return json({ ok: false, error: creator.error }, { status: creator.status });
  }

  const requestedSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (requestedSub && requestedSub !== creator.googleSub) {
    throw error(403, 'Cannot update another creator');
  }

  const id = typeof body.id === 'string' ? body.id.trim() : undefined;
  const markAllSeen = body.markAllSeen === true;

  if (!id && !markAllSeen) {
    throw error(400, 'Provide id or markAllSeen');
  }

  const sb = getServiceSupabase();
  const ok = await markSignalsSeen(sb, creator.googleSub, { id, markAllSeen });

  return json({ ok });
};
