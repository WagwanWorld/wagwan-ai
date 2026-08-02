import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/server/supabase';
import { listCreatorBrandSignals, markSignalsSeen } from '$lib/server/creatorSignals';
import type { SignalType } from '$lib/types/creator-signals';
import { requireAuthenticatedCreator } from '$lib/server/creatorAuth';

export const GET: RequestHandler = async ({ request, url }) => {
  const auth = await requireAuthenticatedCreator(request);
  if (!auth.ok) return auth.response;

  const googleSub = auth.creator.googleSub;
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
    delete (view as { creator_google_sub?: unknown }).creator_google_sub;
    return view;
  });

  return json({ ok: true, signals: views, unseenCount });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const auth = await requireAuthenticatedCreator(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const googleSub = auth.creator.googleSub;

  const id = typeof body.id === 'string' ? body.id.trim() : undefined;
  const markAllSeen = body.markAllSeen === true;

  if (!id && !markAllSeen) {
    throw error(400, 'Provide id or markAllSeen');
  }

  const sb = getServiceSupabase();
  const ok = await markSignalsSeen(sb, googleSub, { id, markAllSeen });

  return json({ ok });
};
