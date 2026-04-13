/**
 * Optional Redis (REDIS_URL) for cross-process Brave search cache and home-feed responses.
 */

import { createClient } from 'redis';
import { env } from '$env/dynamic/private';

/** redis v4 typings can duplicate across optional modules; use a minimal surface here. */
type RedisLite = {
  isOpen: boolean;
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { EX: number }): Promise<string | null>;
  del(key: string): Promise<number>;
  on(event: 'error', fn: (err: Error) => void): void;
};

let client: RedisLite | null = null;
let pending: Promise<RedisLite | null> | null = null;

async function ensureClient(): Promise<RedisLite | null> {
  const url = env.REDIS_URL?.trim();
  if (!url) return null;
  if (client?.isOpen) return client;

  if (!pending) {
    pending = (async (): Promise<RedisLite | null> => {
      try {
        const c = createClient({ url }) as unknown as RedisLite;
        c.on('error', err => console.error('[redis]', err.message));
        await c.connect();
        client = c;
        return c;
      } catch (e) {
        console.error('[redis] connect failed:', e);
        client = null;
        pending = null;
        return null;
      }
    })();
  }

  const c = await pending;
  return c?.isOpen ? c : null;
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const c = await ensureClient();
  if (!c) return null;
  try {
    const raw = await c.get(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error('[redis] get', key, e);
    return null;
  }
}

export async function redisSetJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const c = await ensureClient();
  if (!c) return;
  const ex = Math.max(1, Math.min(Math.floor(ttlSec), 86400));
  try {
    await c.set(key, JSON.stringify(value), { EX: ex });
  } catch (e) {
    console.error('[redis] set', key, e);
  }
}

/** Atomic get + delete for one-shot tokens (Instagram OAuth redemption). */
export async function redisGetDelJson<T>(key: string): Promise<T | null> {
  const c = await ensureClient();
  if (!c) return null;
  try {
    const raw = await c.get(key);
    if (raw == null) return null;
    await c.del(key);
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error('[redis] getdel', key, e);
    return null;
  }
}
