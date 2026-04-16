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
      // Read SSE stream, extract final result
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData: Record<string, unknown> | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.done) finalData = msg;
          } catch {}
        }
      }
      if (!finalData?.updatedAt) return;
      try {
        const { profile } = await import('$lib/stores/profile');
        const patch =
          finalData.updated && typeof finalData.updated === 'object' ? (finalData.updated as Record<string, unknown>) : {};
        profile.update((p) => ({
          ...p,
          ...patch,
          profileUpdatedAt: finalData!.updatedAt as string,
        }));
      } catch {
        /* ignore store update failures */
      }
    })
    .catch(() => {});
}
