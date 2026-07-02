import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfileByWagwanId, getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { listCreatorBrandSignals, markSignalsSeen } from '$lib/server/creatorSignals';
import type { SignalType } from '$lib/types/creator-signals';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { resolveAuthenticatedCreatorProfile } from '$lib/server/creatorAuthCore';

export const GET: RequestHandler = async ({ request, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const auth = await resolveAuthenticatedCreatorProfile(
    request,
    url.searchParams.get('googleSub')?.trim(),
    { isWagwanAuthConfigured, extractWagwanUserId, getProfileByWagwanId },
  );
  if (!auth.ok) return json({ ok: false, error: auth.error }, { status: auth.status });

  const seenParam = url.searchParams.get('seen');
  const signalType = url.searchParams.get('signal_type') as SignalType | null;

  const seen = seenParam === 'true' ? true : seenParam === 'false' ? false : undefined;

  const sb = getServiceSupabase();
  const { signals, unseenCount } = await listCreatorBrandSignals(sb, auth.googleSub, {
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
  const requestedGoogleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : undefined;
  const auth = await resolveAuthenticatedCreatorProfile(request, requestedGoogleSub, {
    isWagwanAuthConfigured,
    extractWagwanUserId,
    getProfileByWagwanId,
  });
  if (!auth.ok) return json({ ok: false, error: auth.error }, { status: auth.status });

  const id = typeof body.id === 'string' ? body.id.trim() : undefined;
  const markAllSeen = body.markAllSeen === true;

  if (!id && !markAllSeen) {
    throw error(400, 'Provide id or markAllSeen');
  }

  const sb = getServiceSupabase();
  const ok = await markSignalsSeen(sb, auth.googleSub, { id, markAllSeen });

  return json({ ok });
};
