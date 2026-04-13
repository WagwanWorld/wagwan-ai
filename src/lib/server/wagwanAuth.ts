/**
 * Wagwan JWT token verification.
 *
 * Wagwan's Go backend signs access tokens with HS256 using the env var PUBLIC_KEY.
 * Token claims: { id: "<user-uuid>", ...RegisteredClaims }
 *
 * We read the same secret from WAGWAN_JWT_SECRET env var on the wagwan-ai side.
 */

import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

interface WagwanTokenClaims {
  /** Wagwan user UUID */
  id: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify a wagwan access token and return the user UUID.
 * Returns null if the token is invalid, expired, or the secret is not configured.
 */
export function verifyWagwanToken(token: string): string | null {
  const secret = env.WAGWAN_JWT_SECRET?.trim();
  if (!secret) {
    console.error('[WagwanAuth] WAGWAN_JWT_SECRET not configured');
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as WagwanTokenClaims;

    const userId = decoded.id?.trim();
    if (!userId) {
      console.error('[WagwanAuth] Token missing id claim');
      return null;
    }

    return userId;
  } catch (err) {
    console.error('[WagwanAuth] Token verification failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Extract wagwan user UUID from a request's Authorization header.
 * Expects: `Authorization: Bearer <wagwan-access-token>`
 * Returns null if header is missing, malformed, or token is invalid.
 */
export function extractWagwanUserId(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  return verifyWagwanToken(token);
}

export function isWagwanAuthConfigured(): boolean {
  return !!(env.WAGWAN_JWT_SECRET?.trim());
}
