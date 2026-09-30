export function normalizeInstagramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^@/, '').toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

export function profileInstagramUsername(
  profileData: Record<string, unknown> | null | undefined,
): string | null {
  const identity = profileData?.instagramIdentity;
  if (!identity || typeof identity !== 'object') return null;
  return normalizeInstagramUsername((identity as Record<string, unknown>).username);
}
