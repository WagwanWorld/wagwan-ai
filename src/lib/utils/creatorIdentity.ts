export function normalizeCreatorHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^@+/, '').toLowerCase();
  if (!trimmed) return null;

  const match = trimmed.match(/(?:instagram\.com\/)?([a-z0-9._]{2,30})\/?$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function profileInstagramUsername(profileData: Record<string, unknown>): string | null {
  const identity = profileData.instagramIdentity;
  if (!identity || typeof identity !== 'object') return null;
  const username = (identity as Record<string, unknown>).username;
  return normalizeCreatorHandle(username);
}

export function doesProfileMatchRosterHandle(
  profileData: Record<string, unknown>,
  rosterHandle: string,
): boolean {
  const profileHandle = profileInstagramUsername(profileData);
  const normalizedRosterHandle = normalizeCreatorHandle(rosterHandle);
  return Boolean(
    profileHandle && normalizedRosterHandle && profileHandle === normalizedRosterHandle,
  );
}
