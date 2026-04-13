import { env } from '$env/dynamic/private';
import type { UserProfileRow } from '$lib/server/supabase';

/** Max age in whole days before optional background refresh. 0 = disabled. Default 7 when unset. */
export function getGraphMaxAgeDays(): number {
  const raw = env.GRAPH_MAX_AGE_DAYS;
  if (raw === undefined || raw === '') return 7;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 7;
  return Math.floor(n);
}

/**
 * Latest ISO timestamp we treat as "graph-relevant activity": row touch, profile sync stamp,
 * or any per-platform signalSyncMeta entry.
 */
export function lastGraphActivityIso(row: Pick<UserProfileRow, 'updated_at' | 'profile_data'>): string {
  const pd = row.profile_data ?? {};
  const candidates: string[] = [row.updated_at].filter(Boolean);

  const pu = pd.profileUpdatedAt;
  if (typeof pu === 'string' && pu.trim()) candidates.push(pu.trim());

  const meta = pd.signalSyncMeta as Record<string, unknown> | undefined;
  if (meta && typeof meta === 'object') {
    for (const v of Object.values(meta)) {
      if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
    }
  }

  if (!candidates.length) return row.updated_at || new Date(0).toISOString();
  return candidates.reduce((a, b) => (a > b ? a : b));
}

export function isGraphStale(lastActivityIso: string, maxAgeDays: number): boolean {
  if (maxAgeDays <= 0) return false;
  const t = new Date(lastActivityIso).getTime();
  if (Number.isNaN(t)) return true;
  const maxMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return Date.now() - t > maxMs;
}

export function graphStaleForRow(row: Pick<UserProfileRow, 'updated_at' | 'profile_data'>): {
  stale: boolean;
  maxAgeDays: number;
  lastActivityAt: string;
} {
  const maxAgeDays = getGraphMaxAgeDays();
  const lastActivityAt = lastGraphActivityIso(row);
  const stale = isGraphStale(lastActivityAt, maxAgeDays);
  return { stale, maxAgeDays, lastActivityAt };
}
