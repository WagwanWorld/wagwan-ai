import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';

export type AuthenticatedCreator = {
  googleSub: string;
  wagwanUserId: string;
  profileData: Record<string, unknown>;
  identityGraph: Record<string, unknown>;
  instagramUsername: string | null;
};

export function normalizeCreatorInstagramUsername(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  let username = raw
    .replace(/^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\//i, '')
    .split('/')[0]
    ?.split('?')[0]
    ?.replace(/^@/, '')
    .trim()
    .toLowerCase();

  if (!username || !/^[a-z0-9._]{2,30}$/.test(username)) return null;
  return username;
}

function readInstagramUsername(source: Record<string, unknown>): string | null {
  const instagramIdentity = source.instagramIdentity;
  if (instagramIdentity && typeof instagramIdentity === 'object') {
    const username = normalizeCreatorInstagramUsername(
      (instagramIdentity as Record<string, unknown>).username,
    );
    if (username) return username;
  }

  const instagram = source.instagram;
  if (instagram && typeof instagram === 'object') {
    const username = normalizeCreatorInstagramUsername(
      (instagram as Record<string, unknown>).username,
    );
    if (username) return username;
  }

  return null;
}

export async function requireAuthenticatedCreator(
  request: Request,
  sb: SupabaseClient,
): Promise<AuthenticatedCreator> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'Wagwan auth not configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Invalid or missing Wagwan token');
  }

  const { data, error: qErr } = await sb
    .from('user_profiles')
    .select('google_sub, profile_data, identity_graph')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (qErr) {
    console.error('[creatorAuth] linked profile lookup failed:', qErr.message);
    throw error(500, 'Could not verify creator');
  }

  if (!data?.google_sub) {
    throw error(403, 'Wagwan account is not linked to a creator profile');
  }

  const profileData = ((data.profile_data ?? {}) as Record<string, unknown>) ?? {};
  const identityGraph = ((data.identity_graph ?? {}) as Record<string, unknown>) ?? {};
  const instagramUsername =
    readInstagramUsername(profileData) ?? readInstagramUsername(identityGraph);

  return {
    googleSub: data.google_sub as string,
    wagwanUserId,
    profileData,
    identityGraph,
    instagramUsername,
  };
}
