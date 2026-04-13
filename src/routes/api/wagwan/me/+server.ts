import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId, isSupabaseConfigured } from '$lib/server/supabase';

/**
 * GET /api/wagwan/me
 *
 * Returns the linked wagwan-ai profile for the authenticated wagwan user.
 * Headers: Authorization: Bearer <wagwan-access-token>
 */
export const GET: RequestHandler = async ({ request }) => {
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

  const profile = await getProfileByWagwanId(wagwanUserId);
  if (!profile) {
    return json({
      ok: true,
      linked: false,
      wagwan_user_id: wagwanUserId,
      message: 'No wagwan-ai profile linked to this wagwan account yet',
    });
  }

  const profileData = (profile.profile_data ?? {}) as Record<string, unknown>;

  return json({
    ok: true,
    linked: true,
    wagwan_user_id: wagwanUserId,
    google_sub: profile.google_sub,
    name: profile.name,
    email: profile.email,
    platforms_connected: {
      google: Boolean(profileData.googleConnected),
      instagram: Boolean(profileData.instagramConnected),
      spotify: Boolean(profileData.spotifyConnected),
      linkedin: Boolean(profileData.linkedinConnected),
      apple_music: Boolean(profileData.appleMusicConnected),
    },
    identity_summary: profile.identity_summary,
    updated_at: profile.updated_at,
  });
};
