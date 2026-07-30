export function normalizeInstagramUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';
}

export function getProfileInstagramUsername(profileData: Record<string, unknown>): string {
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagramIdentity?.username);
}
