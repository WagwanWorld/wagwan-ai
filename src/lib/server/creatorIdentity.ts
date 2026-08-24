export function normalizeInstagramUsername(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function extractProfileInstagramUsername(
  profileData: Record<string, unknown> | null | undefined,
): string {
  const instagramIdentity = profileData?.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagramIdentity?.username);
}
