import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import {
  BRAND_SESSION_COOKIE,
  BRAND_SESSION_MAX_AGE_SEC,
  mintBrandSessionCookieValue,
} from '$lib/server/marketplace/brandSession';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const secret = (env.BRAND_PORTAL_SECRET ?? '').trim();
  if (!secret) {
    return json({ ok: false, error: 'brand_portal_not_configured' }, { status: 503 });
  }

  let body: { portalSecret?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const submitted = typeof body.portalSecret === 'string' ? body.portalSecret : '';
  if (!submitted || !safeEqual(submitted, secret)) {
    throw error(401, 'Invalid portal credentials');
  }

  const value = mintBrandSessionCookieValue();
  const secure = url.protocol === 'https:';

  cookies.set(BRAND_SESSION_COOKIE, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: BRAND_SESSION_MAX_AGE_SEC,
  });

  return json({ ok: true });
};
