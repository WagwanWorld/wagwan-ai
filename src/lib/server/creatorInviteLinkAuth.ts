import type { SupabaseClient } from '@supabase/supabase-js';

export type InstagramOwnershipProfile = {
  id?: string | null;
  username?: string | null;
};

export function normalizeInstagramHandle(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/^@+/, '').toLowerCase();
}

export function accountKeyMatchesInstagram(
  googleSub: string,
  igProfile: InstagramOwnershipProfile,
): boolean {
  const sub = googleSub.trim();
  const id = igProfile.id?.trim();
  const username = normalizeInstagramHandle(igProfile.username);

  if (id && sub === `ig:${id}`) return true;
  if (username && sub === `ig:user:${username}`) return true;
  return false;
}

export async function profileMatchesInstagram(
  sb: SupabaseClient,
  googleSub: string,
  igProfile: InstagramOwnershipProfile,
): Promise<boolean> {
  if (accountKeyMatchesInstagram(googleSub, igProfile)) return true;

  const { data: profileRow, error: profileError } = await sb
    .from('user_profiles')
    .select('profile_data')
    .eq('google_sub', googleSub)
    .maybeSingle();

  if (profileError || !profileRow) {
    return false;
  }

  const profileData = (profileRow.profile_data ?? {}) as Record<string, unknown>;
  const instagramIdentity = profileData.instagramIdentity as
    | { igUserId?: string; username?: string }
    | undefined;
  const savedIgId = instagramIdentity?.igUserId?.trim();
  const savedUsername = normalizeInstagramHandle(instagramIdentity?.username);
  const tokenIgId = igProfile.id?.trim();
  const tokenUsername = normalizeInstagramHandle(igProfile.username);

  return Boolean(
    (savedIgId && tokenIgId && savedIgId === tokenIgId) ||
      (savedUsername && tokenUsername && savedUsername === tokenUsername),
  );
}
