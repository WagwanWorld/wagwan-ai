export function normalizeCreatorInstagramUsername(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function getProfileInstagramUsername(profileData: Record<string, unknown>): string {
  const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeCreatorInstagramUsername(ig?.username);
}
