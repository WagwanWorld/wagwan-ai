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
import { getAndDeleteIdentity } from '$lib/server/igIdentityStore';
import {
  CREATOR_SESSION_COOKIE,
  CREATOR_SESSION_COOKIE_OPTIONS,
  getCreatorSessionSubFromRequest,
  mintCreatorSessionCookieValue,
} from '$lib/server/creatorSession';

export const GET: RequestHandler = async ({ url, request, cookies }) => {
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'missing_token' }, { status: 400 });

  const result = await getAndDeleteIdentity(token);
  if (!result) return json({ error: 'expired_or_invalid' }, { status: 404 });

  if (!getCreatorSessionSubFromRequest(request)) {
    const igUserId = result.identity.igUserId?.trim();
    const username = result.identity.username?.trim().toLowerCase();
    const accountSub = igUserId ? `ig:${igUserId}` : username ? `ig:user:${username}` : '';
    if (accountSub) {
      cookies.set(
        CREATOR_SESSION_COOKIE,
        mintCreatorSessionCookieValue(accountSub),
        CREATOR_SESSION_COOKIE_OPTIONS,
      );
    }
  }

  return json({ identity: result.identity, accessToken: result.accessToken });
};
