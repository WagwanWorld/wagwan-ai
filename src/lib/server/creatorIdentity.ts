export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let username = value.trim();
  if (!username) return null;

  const urlMatch = username.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
  if (urlMatch) username = urlMatch[1];

  username = username.replace(/^@/, '').trim().toLowerCase();
  return username ? username : null;
}

export function instagramUsernameFromProfile(
  profileData: Record<string, unknown> | null,
): string | null {
  const ig = profileData?.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(ig?.username);
}

export function creatorInstagramMatchesRoster(
  profileData: Record<string, unknown> | null,
  rosterHandle: unknown,
): boolean {
  const creatorUsername = instagramUsernameFromProfile(profileData);
  const rosterUsername = normalizeInstagramUsername(rosterHandle);
  return Boolean(creatorUsername && rosterUsername && creatorUsername === rosterUsername);
}
