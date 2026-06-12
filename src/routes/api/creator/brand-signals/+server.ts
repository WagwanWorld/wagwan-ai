import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getProfile, getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { listCreatorBrandSignals, markSignalsSeen } from '$lib/server/creatorSignals';
import {
  IG_ACCOUNT_PROOF_COOKIE,
  normalizeInstagramUsername,
  verifyInstagramAccountProof,
} from '$lib/server/marketplace/accountProof';
import type { SignalType } from '$lib/types/creator-signals';

async function assertCreatorAccess(
  googleSub: string,
  proofCookie: string | undefined,
): Promise<void> {
  const cookieSecret = env.COOKIE_SECRET?.trim();
  if (!cookieSecret) throw error(503, 'Creator authentication not configured');

  const proof = verifyInstagramAccountProof(proofCookie, cookieSecret);
  if (!proof) throw error(401, 'Instagram account proof is required');

  if (googleSub === `ig:${proof.igUserId}` || googleSub === `ig:user:${proof.username}`) {
    return;
  }

  const profile = await getProfile(googleSub);
  const instagramIdentity = profile?.profile_data?.instagramIdentity as
    | { igUserId?: unknown; username?: unknown }
    | undefined;
  const profileIgUserId =
    typeof instagramIdentity?.igUserId === 'string' ? instagramIdentity.igUserId.trim() : '';
  const profileUsername =
    typeof instagramIdentity?.username === 'string'
      ? normalizeInstagramUsername(instagramIdentity.username)
      : '';

  if (
    profileIgUserId === proof.igUserId ||
    (profileUsername && profileUsername === proof.username)
  ) {
    return;
  }

  throw error(403, 'Creator access denied');
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const googleSub = url.searchParams.get('googleSub')?.trim();
  if (!googleSub) throw error(400, 'googleSub is required');
  await assertCreatorAccess(googleSub, cookies.get(IG_ACCOUNT_PROOF_COOKIE));

  const seenParam = url.searchParams.get('seen');
  const signalType = url.searchParams.get('signal_type') as SignalType | null;

  const seen = seenParam === 'true' ? true : seenParam === 'false' ? false : undefined;

  const sb = getServiceSupabase();
  const { signals, unseenCount } = await listCreatorBrandSignals(sb, googleSub, {
    seen,
    signalType: signalType ?? undefined,
  });

  // Strip creator_google_sub from response
  const views = signals.map(({ creator_google_sub: _sub, ...rest }) => rest);

  return json({ ok: true, signals: views, unseenCount });
};

export const PATCH: RequestHandler = async ({ request, cookies }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const body = await request.json();
  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!googleSub) throw error(400, 'googleSub is required');
  await assertCreatorAccess(googleSub, cookies.get(IG_ACCOUNT_PROOF_COOKIE));

  const id = typeof body.id === 'string' ? body.id.trim() : undefined;
  const markAllSeen = body.markAllSeen === true;

  if (!id && !markAllSeen) {
    throw error(400, 'Provide id or markAllSeen');
  }

  const sb = getServiceSupabase();
  const ok = await markSignalsSeen(sb, googleSub, { id, markAllSeen });

  return json({ ok });
};
