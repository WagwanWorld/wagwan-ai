export function normalizeInstagramUsername(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function profileInstagramUsername(profileData: Record<string, unknown>): string {
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagramIdentity?.username);
}
