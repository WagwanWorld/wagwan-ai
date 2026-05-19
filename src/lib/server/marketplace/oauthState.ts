import { createHmac } from 'node:crypto';
import { COOKIE_SECRET } from '$env/static/private';

const MAX_AGE_SEC = 600; // 10 minutes

/**
 * Sign an OAuth state nonce so the callback can verify it without a cookie.
 * Format: `nonce:expiry:hmac`
 *
 * Safari ITP can silently drop cookies set in a 302 redirect response,
 * which breaks the standard cookie-based CSRF check for OAuth flows.
 * By embedding a signed expiry in the state parameter itself, the callback
 * can verify authenticity without depending on the cookie.
 */
export function signOAuthState(nonce: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `${nonce}:${exp}`;
  const sig = createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

/**
 * Verify a signed OAuth state. Returns the nonce if valid, null otherwise.
 */
export function verifyOAuthState(state: string): string | null {
  if (!state) return null;
  const lastColon = state.lastIndexOf(':');
  if (lastColon <= 0) return null;

  const payload = state.slice(0, lastColon);
  const sig = state.slice(lastColon + 1);

  const parts = payload.split(':');
  if (parts.length !== 2) return null;

  const [nonce, expStr] = parts;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  const expected = createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  if (sig.length !== expected.length || sig !== expected) return null;

  return nonce;
}
