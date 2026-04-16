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
 * Assert brand access. Returns the brand's ig_user_id if authenticated via IG session.
 * Falls back to X-Brand-Key header or allowlisted google_sub for legacy/API access.
 */
export function assertBrandAccess(request: Request, bodyGoogleSub?: string | null): string | null {
  const secret = (env.BRAND_PORTAL_SECRET ?? '').trim();
  const allowRaw = (env.BRAND_ALLOWLIST_GOOGLE_SUBS ?? '').trim();
  const allow = allowRaw
    ? allowRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // Check IG session cookie (v2 with ig_user_id)
  const sessionRaw = getBrandSessionFromRequest(request);
  const igUserId = verifyBrandSessionCookieValue(sessionRaw);
  if (igUserId && igUserId !== '__legacy__') {
    return igUserId;
  }
  // Legacy v1 session (password-based)
  if (igUserId === '__legacy__') {
    return null;
  }

  // X-Brand-Key header fallback
  const headerKey = request.headers.get('x-brand-key')?.trim() ?? '';
  if (secret && headerKey && safeEqual(headerKey, secret)) {
    return null;
  }

  // Allowlisted google_sub fallback
  const sub = (bodyGoogleSub ?? '').trim();
  if (sub && allow.length && allow.includes(sub)) {
    return null;
  }

  if (!secret && !allow.length) {
    throw error(503, 'Brand portal not configured');
  }

  throw error(401, 'Brand access denied');
}
