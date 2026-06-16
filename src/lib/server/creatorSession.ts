import { createHmac, timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';

export const CREATOR_SESSION_COOKIE = 'wagwan_creator_session';

const MAX_AGE_SEC = 60 * 60 * 24 * 7;
const cookieSecure = (process.env.PUBLIC_BASE_URL ?? '').startsWith('https://');

function cookieSecret(): string {
  const secret = process.env.COOKIE_SECRET?.trim();
  if (!secret) throw new Error('COOKIE_SECRET is required for creator sessions');
  return secret;
}

function signPayload(payload: string): string {
  return createHmac('sha256', cookieSecret()).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function mintCreatorSessionCookieValue(accountSub: string): string {
  const sub = accountSub.trim();
  if (!sub) throw new Error('Cannot mint creator session without account sub');

  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const encodedSub = Buffer.from(sub, 'utf8').toString('base64url');
  const payload = `v1:${encodedSub}:${exp}`;
  return `${payload}:${signPayload(payload)}`;
}

export function verifyCreatorSessionCookieValue(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;

  const lastColon = raw.lastIndexOf(':');
  if (lastColon <= 0) return null;

  const payload = raw.slice(0, lastColon);
  const sig = raw.slice(lastColon + 1);
  const parts = payload.split(':');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;

  const exp = Number.parseInt(parts[2], 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  if (!safeEqual(sig, signPayload(payload))) return null;

  try {
    return Buffer.from(parts[1], 'base64url').toString('utf8') || null;
  } catch {
    return null;
  }
}

export function getCreatorSessionFromRequest(request: Request): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    if (k !== CREATOR_SESSION_COOKIE) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }

  return;
}

export function getCreatorSessionSubFromRequest(request: Request): string | null {
  return verifyCreatorSessionCookieValue(getCreatorSessionFromRequest(request));
}

export function assertCreatorSessionSub(request: Request, suppliedSub?: string | null): string {
  const sessionSub = getCreatorSessionSubFromRequest(request);
  if (!sessionSub) {
    throw error(401, 'Creator session required');
  }

  const requestedSub = suppliedSub?.trim();
  if (requestedSub && requestedSub !== sessionSub) {
    throw error(403, 'Creator session mismatch');
  }

  return sessionSub;
}

export const CREATOR_SESSION_COOKIE_OPTIONS = {
  path: '/',
  maxAge: MAX_AGE_SEC,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: cookieSecure,
};

export { MAX_AGE_SEC as CREATOR_SESSION_MAX_AGE_SEC };
