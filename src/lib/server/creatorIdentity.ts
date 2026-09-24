export function normalizeCreatorInstagramUsername(value: unknown): string | null {
  const username = String(value ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();

  return username || null;
}

export function instagramUsernameFromProfileData(
  profileData: Record<string, unknown> | null | undefined,
): string | null {
  const identity = profileData?.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeCreatorInstagramUsername(identity?.username);
}
