/**
 * Push the current client profile (+ optional OAuth token patches) to Supabase
 * and rebuild the server-side identity graph. Use after connecting platforms
 * from profile (not only during onboarding).
 */

import type { UserProfile } from '$lib/stores/profile';

export type ProfileTokenPatch = Partial<{
  linkedinToken: string;
  spotifyToken: string;
  instagramToken: string;
  googleAccessToken: string;
  googleRefreshToken: string;
  appleMusicUserToken: string;
}>;

export async function syncProfileToSupabase(
  p: UserProfile,
  tokenPatch?: ProfileTokenPatch,
): Promise<boolean> {
  if (!p.googleSub) return false;

  const tokens: Record<string, string> = {};
  if (p.googleAccessToken) tokens.googleAccessToken = p.googleAccessToken;
  if (p.googleRefreshToken) tokens.googleRefreshToken = p.googleRefreshToken;
  if (tokenPatch) {
    for (const [k, v] of Object.entries(tokenPatch)) {
      if (v) tokens[k] = v;
    }
  }

  const profilePayload = {
    ...p,
    profileUpdatedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleSub: p.googleSub,
        profile: profilePayload,
        ...(Object.keys(tokens).length > 0 ? { tokens } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
