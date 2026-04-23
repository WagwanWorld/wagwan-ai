import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfile, isSupabaseConfigured } from '$lib/server/supabase';
import { graphStaleForRow } from '$lib/server/graphStaleness';
import { env } from '$env/dynamic/private';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Anyone who knows a google sub could previously hydrate that user's profile
 * by calling `/api/profile/load?sub=...`. We now optionally gate this behind
 * an HMAC signature. Callers must pass `?sig=<hex>` where `sig` is
 * `HMAC-SHA256(COOKIE_SECRET, sub)`. The gate is enabled when
 * `PROFILE_LOAD_REQUIRE_SIG=1`; otherwise requests fall back to the legacy
 * behaviour to preserve existing clients.
 */
function verifySignature(sub: string, sig: string | null): boolean {
  const secret = env.COOKIE_SECRET;
  if (!secret) return false;
  if (!sig) return false;
  const expected = createHmac('sha256', secret).update(sub).digest('hex');
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const GET: RequestHandler = async ({ url, request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub');
  if (!sub) {
    return json({ ok: false, error: 'missing_sub' }, { status: 400 });
  }

  const sigRequired = env.PROFILE_LOAD_REQUIRE_SIG === '1';
  if (sigRequired) {
    const sig = url.searchParams.get('sig') ?? request.headers.get('x-wagwan-sig');
    if (!verifySignature(sub, sig)) {
      return json({ ok: false, error: 'invalid_signature' }, { status: 401 });
    }
  }

  const row = await getProfile(sub);
  if (!row) {
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const {
    stale: graphStale,
    maxAgeDays: graphMaxAgeDays,
    lastActivityAt: graphLastActivityAt,
  } = graphStaleForRow(row);

  return json({
    ok: true,
    profile: row.profile_data,
    updatedAt: row.updated_at,
    graphStale,
    graphMaxAgeDays,
    graphLastActivityAt,
  });
};
