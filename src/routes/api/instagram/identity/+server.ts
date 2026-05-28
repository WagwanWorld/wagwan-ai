/**
 * GET /api/instagram/identity?token=<redemption_token>
 *
 * Retrieves the full Instagram identity graph using a short-lived token.
 * The callback stores the identity server-side and gives the client a
 * redemption token via cookie. The client redeems it here to get the
 * full payload (which exceeds cookie size limits).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { getAndDeleteIdentity } from '$lib/server/igIdentityStore';
import {
  IG_ACCOUNT_PROOF_COOKIE,
  IG_ACCOUNT_PROOF_MAX_AGE_SEC,
  signInstagramAccountProof,
} from '$lib/server/marketplace/accountProof';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'missing_token' }, { status: 400 });

  const cookieSecret = privateEnv.COOKIE_SECRET?.trim();
  if (!cookieSecret) return json({ error: 'creator_auth_not_configured' }, { status: 503 });

  const result = await getAndDeleteIdentity(token);
  if (!result) return json({ error: 'expired_or_invalid' }, { status: 404 });

  cookies.set(
    IG_ACCOUNT_PROOF_COOKIE,
    signInstagramAccountProof(
      { igUserId: result.identity.igUserId, username: result.identity.username },
      cookieSecret,
    ),
    {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: IG_ACCOUNT_PROOF_MAX_AGE_SEC,
      secure: (publicEnv.PUBLIC_BASE_URL ?? '').startsWith('https://'),
    },
  );

  return json({ identity: result.identity, accessToken: result.accessToken });
};
