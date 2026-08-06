export function getWagwanAccessToken(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem('wagwan_access_token') ?? '';
}

export function wagwanAuthHeaders(base: Record<string, string> = {}): Record<string, string> {
  const token = getWagwanAccessToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}
