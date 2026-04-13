/**
 * Short-lived store for Instagram identity payloads (OAuth callback → client redemption).
 *
 * - When REDIS_URL is set, entries are written to Redis so any Node worker can redeem them.
 * - Otherwise in-process Map only (single-worker dev / small deploys).
 *
 * Client redeems via /api/instagram/identity?token=X or onboarding/profile reads ?ig_rt= from redirect.
 */

import type { InstagramIdentity } from './instagram';
import { redisGetDelJson, redisSetJson } from './redisCache';

interface StoreEntry {
  identity: InstagramIdentity;
  accessToken: string;
  expiresAt: number;
}

const REDIS_PREFIX = 'wagwan:ig:redemption:v1:';
const store = new Map<string, StoreEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const TTL_SEC = Math.ceil(TTL_MS / 1000);
const MAX_ENTRIES = 50;

function pruneMemory(now: number): void {
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }
  while (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
}

export async function storeIdentity(
  token: string,
  identity: InstagramIdentity,
  accessToken = '',
): Promise<void> {
  const now = Date.now();
  const entry: StoreEntry = { identity, accessToken, expiresAt: now + TTL_MS };
  await redisSetJson(REDIS_PREFIX + token, entry, TTL_SEC);

  pruneMemory(now);
  store.set(token, entry);
}

export async function getAndDeleteIdentity(
  token: string,
): Promise<{ identity: InstagramIdentity; accessToken: string } | null> {
  const fromRedis = await redisGetDelJson<StoreEntry>(REDIS_PREFIX + token);
  if (fromRedis) {
    if (fromRedis.expiresAt <= Date.now()) return null;
    return { identity: fromRedis.identity, accessToken: fromRedis.accessToken };
  }

  const entry = store.get(token);
  if (!entry) return null;
  store.delete(token);
  if (entry.expiresAt <= Date.now()) return null;
  return { identity: entry.identity, accessToken: entry.accessToken };
}
