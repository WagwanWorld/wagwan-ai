export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let username = value.trim();
  if (!username) return null;
  username = username.replace(/^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\//i, '');
  username = username.split('/')[0] ?? username;
  username = username.split('?')[0] ?? username;
  username = username.replace(/^@/, '').trim().toLowerCase();
  return username || null;
}

export function profileInstagramUsername(profileData: Record<string, unknown>): string | null {
  const instagram = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagram?.username);
}
