// Brand session signing: set COOKIE_SECRET in .env (see .env.example → App config).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { COOKIE_SECRET } from '$env/static/private';

export const BRAND_SESSION_COOKIE = 'wagwan_brand_session';

/** Brand portal cookie TTL (seconds). */
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function signPayload(payload: string): string {
  return createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
}

/** Value stored in the httpOnly cookie (opaque to the client). */
export function mintBrandSessionCookieValue(): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `v1:${exp}`;
  const sig = signPayload(payload);
  return `${payload}:${sig}`;
}

export function verifyBrandSessionCookieValue(raw: string | undefined): boolean {
  if (!raw?.trim()) return false;
  const lastColon = raw.lastIndexOf(':');
  if (lastColon <= 0) return false;
  const payload = raw.slice(0, lastColon);
  const sig = raw.slice(lastColon + 1);
  if (!payload.startsWith('v1:')) return false;
  const exp = parseInt(payload.slice(3), 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = signPayload(payload);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getBrandSessionFromRequest(request: Request): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    if (k !== BRAND_SESSION_COOKIE) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return;
}

export { MAX_AGE_SEC as BRAND_SESSION_MAX_AGE_SEC };
