export function normalizeCreatorUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';
}

export function getProfileInstagramUsername(profileData: Record<string, unknown> | null): string {
  const instagram = profileData?.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeCreatorUsername(instagram?.username);
}

export function creatorProfileMatchesRosterHandle(
  profileData: Record<string, unknown> | null,
  rosterHandle: string,
): boolean {
  const profileUsername = getProfileInstagramUsername(profileData);
  return !!profileUsername && profileUsername === normalizeCreatorUsername(rosterHandle);
}
