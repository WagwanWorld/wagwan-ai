type ProfileWithData = {
  profile_data: Record<string, unknown> | null | undefined;
};

export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  return normalized || null;
}

export function creatorInstagramUsername(profile: ProfileWithData): string | null {
  const data = profile.profile_data ?? {};
  const instagramIdentity =
    typeof data.instagramIdentity === 'object' && data.instagramIdentity !== null
      ? (data.instagramIdentity as Record<string, unknown>)
      : null;
  return normalizeInstagramUsername(instagramIdentity?.username);
}

export function creatorMatchesRosterInstagram(
  profile: ProfileWithData,
  rosterIgUsername: unknown,
): boolean {
  const creatorHandle = creatorInstagramUsername(profile);
  const rosterHandle = normalizeInstagramUsername(rosterIgUsername);
  return Boolean(creatorHandle && rosterHandle && creatorHandle === rosterHandle);
}
