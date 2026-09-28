export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  return normalized || null;
}

export function instagramUsernameFromProfile(profileData: Record<string, unknown>): string | null {
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagramIdentity?.username);
}
