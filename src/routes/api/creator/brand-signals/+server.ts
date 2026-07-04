import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { listCreatorBrandSignals, markSignalsSeen } from '$lib/server/creatorSignals';
import { requireCreatorProfile } from '$lib/server/creatorAuth';
import type { SignalType } from '$lib/types/creator-signals';

export const GET: RequestHandler = async ({ request, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const auth = await requireCreatorProfile(request);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const googleSub = auth.profile.google_sub;

  const seenParam = url.searchParams.get('seen');
  const signalType = url.searchParams.get('signal_type') as SignalType | null;

  const seen = seenParam === 'true' ? true : seenParam === 'false' ? false : undefined;

  const sb = getServiceSupabase();
  const { signals, unseenCount } = await listCreatorBrandSignals(sb, googleSub, {
    seen,
    signalType: signalType ?? undefined,
  });

  // Strip creator_google_sub from response
  const views = signals.map((signal) => {
    const view = { ...signal };
    delete (view as Partial<typeof signal>).creator_google_sub;
    return view;
  });

  return json({ ok: true, signals: views, unseenCount });
};

export const PATCH: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const auth = await requireCreatorProfile(request);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const googleSub = auth.profile.google_sub;

  const id = typeof body.id === 'string' ? body.id.trim() : undefined;
  const markAllSeen = body.markAllSeen === true;

  if (!id && !markAllSeen) {
    throw error(400, 'Provide id or markAllSeen');
  }

  const sb = getServiceSupabase();
  const ok = await markSignalsSeen(sb, googleSub, { id, markAllSeen });

  return json({ ok });
};
