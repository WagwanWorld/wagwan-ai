import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { listCreatorBrandSignals, markSignalsSeen } from '$lib/server/creatorSignals';
import type { SignalType } from '$lib/types/creator-signals';
import { isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { requireCreatorFromWagwanRequest } from '$lib/server/creatorAuth';

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
  const creator = await requireCreatorFromWagwanRequest(request, sb);
  const { signals, unseenCount } = await listCreatorBrandSignals(sb, creator.googleSub, {
    seen,
    signalType: signalType ?? undefined,
  });

  // Strip creator_google_sub from response
  const views = signals.map((signal) => {
    const view: Partial<typeof signal> = { ...signal };
    delete view.creator_google_sub;
    return view;
  });

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
  const creator = await requireCreatorFromWagwanRequest(request, sb);
  const ok = await markSignalsSeen(sb, creator.googleSub, { id, markAllSeen });

  return json({ ok });
};
