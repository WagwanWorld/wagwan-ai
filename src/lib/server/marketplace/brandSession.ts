import { createHmac, timingSafeEqual } from 'node:crypto';
import { COOKIE_SECRET } from '$env/static/private';

export const BRAND_SESSION_COOKIE = 'wagwan_brand_session';

const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function signPayload(payload: string): string {
  return createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
}

/** Mint a session cookie that embeds the brand's IG user ID. */
export function mintBrandSessionCookieValue(igUserId: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `v2:${igUserId}:${exp}`;
  const sig = signPayload(payload);
  return `${payload}:${sig}`;
}

/** Verify cookie and return the ig_user_id if valid, null otherwise. */
export function verifyBrandSessionCookieValue(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const lastColon = raw.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const payload = raw.slice(0, lastColon);
  const sig = raw.slice(lastColon + 1);

  // Support v2 (with ig_user_id) and v1 (legacy, no ig_user_id)
  if (payload.startsWith('v2:')) {
    const parts = payload.split(':');
    if (parts.length !== 3) return null;
    const igUserId = parts[1];
    const exp = parseInt(parts[2], 10);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
    const expected = signPayload(payload);
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return igUserId;
  }

  // Legacy v1 (no ig_user_id)
  if (payload.startsWith('v1:')) {
    const exp = parseInt(payload.slice(3), 10);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
    const expected = signPayload(payload);
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return '__legacy__';
  }

  return null;
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
