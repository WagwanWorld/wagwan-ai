export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  let username = value.trim();
  if (!username) return null;

  username = username.replace(/^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\//i, '');
  username = username.split('/')[0] || username;
  username = username.split('?')[0] || username;
  username = username.replace(/^@/, '').trim().toLowerCase();

  return username || null;
}

export function instagramUsernameFromProfileData(
  profileData: Record<string, unknown> | null | undefined,
): string | null {
  const profile = profileData ?? {};
  const instagram = profile.instagramIdentity as Record<string, unknown> | undefined;
  return (
    normalizeInstagramUsername(instagram?.username) ??
    normalizeInstagramUsername(instagram?.handle) ??
    normalizeInstagramUsername(profile.instagramUsername) ??
    normalizeInstagramUsername(profile.ig_username)
  );
}
