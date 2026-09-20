function normalizeInstagramUsername(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const withoutAt = raw.replace(/^@/, '');
  const urlMatch = withoutAt.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
  const username = (urlMatch?.[1] ?? withoutAt).toLowerCase();
  return /^[a-z0-9._]{2,30}$/.test(username) ? username : null;
}

export function creatorInstagramUsername(profileData: Record<string, unknown>): string | null {
  const instagramIdentity = profileData.instagramIdentity as Record<string, unknown> | undefined;
  return normalizeInstagramUsername(instagramIdentity?.username);
}

export function normalizeCreatorRosterHandle(handle: string): string | null {
  return normalizeInstagramUsername(handle);
}
