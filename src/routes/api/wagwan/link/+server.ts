import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import {
  getProfile,
  getProfileByWagwanId,
  linkWagwanUser,
  isSupabaseConfigured,
} from '$lib/server/supabase';

/**
 * POST /api/wagwan/link
 *
 * Links a wagwan-ai profile to the authenticated wagwan user.
 *
 * Headers: Authorization: Bearer <wagwan-access-token>
 * Body: { "googleSub": "<wagwan-ai profile key>" }
 *
 * Returns: { ok: true, wagwanUserId, googleSub }
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  if (!isWagwanAuthConfigured()) {
    return json({ ok: false, error: 'wagwan_auth_not_configured' }, { status: 503 });
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    return json({ ok: false, error: 'invalid_or_missing_token' }, { status: 401 });
  }

  let body: { googleSub?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!googleSub) {
    return json({ ok: false, error: 'missing_google_sub' }, { status: 400 });
  }

  // Check the wagwan-ai profile exists
  const profile = await getProfile(googleSub);
  if (!profile) {
    return json({ ok: false, error: 'profile_not_found' }, { status: 404 });
  }

  // Check if this wagwan user is already linked to a different profile
  const existing = await getProfileByWagwanId(wagwanUserId);
  if (existing && existing.google_sub !== googleSub) {
    return json(
      { ok: false, error: 'wagwan_user_already_linked', linked_to: existing.google_sub },
      { status: 409 },
    );
  }

  // Link the profile
  const success = await linkWagwanUser(googleSub, wagwanUserId);
  if (!success) {
    return json({ ok: false, error: 'link_failed' }, { status: 500 });
  }

  return json({ ok: true, wagwanUserId, googleSub });
};
