import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { listCreatorBrandSignals, markSignalsSeen } from '$lib/server/creatorSignals';
import type { SignalType } from '$lib/types/creator-signals';
import { getAuthenticatedCreatorProfile } from '$lib/server/creatorAuth';
import { isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

export const GET: RequestHandler = async ({ request, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  if (!isWagwanAuthConfigured()) {
    return json({ ok: false, error: 'wagwan_auth_not_configured' }, { status: 503 });
  }

  const seenParam = url.searchParams.get('seen');
  const signalType = url.searchParams.get('signal_type') as SignalType | null;

  const seen = seenParam === 'true' ? true : seenParam === 'false' ? false : undefined;

  const sb = getServiceSupabase();
  const creator = await getAuthenticatedCreatorProfile(request, sb);
  if (!creator) {
    return json({ ok: false, error: 'invalid_or_missing_token' }, { status: 401 });
  }

  const googleSub = creator.google_sub;
  const { signals, unseenCount } = await listCreatorBrandSignals(sb, googleSub, {
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
  if (!isWagwanAuthConfigured()) {
    return json({ ok: false, error: 'wagwan_auth_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id.trim() : undefined;
  const markAllSeen = body.markAllSeen === true;

  if (!id && !markAllSeen) {
    throw error(400, 'Provide id or markAllSeen');
  }

  const sb = getServiceSupabase();
  const creator = await getAuthenticatedCreatorProfile(request, sb);
  if (!creator) {
    return json({ ok: false, error: 'invalid_or_missing_token' }, { status: 401 });
  }

  const googleSub = creator.google_sub;
  const ok = await markSignalsSeen(sb, googleSub, { id, markAllSeen });

  return json({ ok });
};
