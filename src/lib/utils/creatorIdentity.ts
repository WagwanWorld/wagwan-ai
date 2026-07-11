export function normalizeInstagramUsername(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function instagramUsernamesMatch(a: unknown, b: unknown): boolean {
  const left = normalizeInstagramUsername(a);
  const right = normalizeInstagramUsername(b);
  return Boolean(left && right && left === right);
}
