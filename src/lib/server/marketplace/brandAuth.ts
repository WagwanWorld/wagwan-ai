import { error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getBrandSessionFromRequest, verifyBrandSessionCookieValue } from './brandSession';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Brand APIs: signed httpOnly cookie (from /api/brands/login), or X-Brand-Key, or allowlisted google_sub.
 * Env: `BRAND_PORTAL_SECRET`, `BRAND_ALLOWLIST_GOOGLE_SUBS` — see `.env.example` (Brand portal).
 */
export function assertBrandAccess(request: Request, bodyGoogleSub?: string | null): void {
  const secret = (env.BRAND_PORTAL_SECRET ?? '').trim();
  const allowRaw = (env.BRAND_ALLOWLIST_GOOGLE_SUBS ?? '').trim();
  const allow = allowRaw
    ? allowRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : [];

  const sessionRaw = getBrandSessionFromRequest(request);
  if (verifyBrandSessionCookieValue(sessionRaw)) {
    return;
  }

  const headerKey = request.headers.get('x-brand-key')?.trim() ?? '';

  if (secret && headerKey && safeEqual(headerKey, secret)) {
    return;
  }

  const sub = (bodyGoogleSub ?? '').trim();
  if (sub && allow.length && allow.includes(sub)) {
    return;
  }

  if (!secret && !allow.length) {
    throw error(503, 'Brand portal not configured (set BRAND_PORTAL_SECRET or BRAND_ALLOWLIST_GOOGLE_SUBS)');
  }

  throw error(401, 'Brand access denied');
}
