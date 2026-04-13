/**
 * Lightweight JSON logs for API latency debugging (enable with API_TIMING_LOG=1).
 *
 * Env (optional):
 * - REDIS_URL — shared cache (Brave + home-feed); see redisCache.ts
 * - HOME_FEED_REDIS_TTL_SEC — home-feed Redis TTL (default 720, max 86400)
 * - BRAVE_EMPTY_RESULT_RETRIES — extra Brave attempts on empty body (0–2, default 0)
 * - API_TIMING_LOG=1 — emit api_timing JSON lines for tuned routes
 */

import { env } from '$env/dynamic/private';

export function timingEnabled(): boolean {
  const v = env.API_TIMING_LOG;
  return v === '1' || v === 'true';
}

export function createApiTimer(route: string) {
  const t0 = performance.now();
  const phases: Record<string, number> = {};

  return {
    mark(phase: string) {
      phases[phase] = Math.round(performance.now() - t0);
    },
    finish(extra?: Record<string, unknown>) {
      if (!timingEnabled()) return;
      const totalMs = Math.round(performance.now() - t0);
      console.log(
        JSON.stringify({
          type: 'api_timing',
          route,
          totalMs,
          phases,
          ...extra,
          at: new Date().toISOString(),
        }),
      );
    },
  };
}
