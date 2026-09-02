export function normalizeInstagramUsername(value: unknown): string | null {
  const username = String(value ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  return username || null;
}

export function getProfileInstagramUsername(
  profileData: Record<string, unknown> | null | undefined,
): string | null {
  const instagramIdentity = profileData?.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagramIdentity?.username);
}
