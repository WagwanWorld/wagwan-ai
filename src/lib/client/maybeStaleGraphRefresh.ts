/**
 * Fire-and-forget POST /api/refresh-signals when the server marks the graph stale.
 * Debounced per googleSub in sessionStorage to avoid hammering on repeated full reloads.
 */

const STORAGE_PREFIX = 'wagwan_stale_graph_refresh_';
/** Minimum ms between refresh attempts for the same user (session tab). */
const MIN_INTERVAL_MS = 15 * 60 * 1000;

export function maybeStaleGraphRefresh(googleSub: string, graphStale: boolean): void {
  if (!graphStale || !googleSub || typeof window === 'undefined') return;

  const key = STORAGE_PREFIX + googleSub;
  const now = Date.now();
  try {
    const prev = Number(sessionStorage.getItem(key) ?? '');
    if (Number.isFinite(prev) && now - prev < MIN_INTERVAL_MS) return;
    sessionStorage.setItem(key, String(now));
  } catch {
    /* quota / private mode */
  }

  void fetch('/api/refresh-signals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ googleSub }),
  })
    .then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as {
        updated?: Record<string, unknown>;
        updatedAt?: string;
      } | null;
      if (!data?.updatedAt) return;
      try {
        const { profile } = await import('$lib/stores/profile');
        const patch =
          data.updated && typeof data.updated === 'object' ? data.updated : {};
        profile.update((p) => ({
          ...p,
          ...patch,
          profileUpdatedAt: data.updatedAt!,
        }));
      } catch {
        /* ignore store update failures */
      }
    })
    .catch(() => {});
}
