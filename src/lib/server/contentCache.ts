/**
 * Two-layer content cache: Redis (hot) → Supabase (persistent) → compute.
 * LLM only runs on cache miss.
 */

import { redisGetJson, redisSetJson, redisDel } from './redisCache';
import { getServiceSupabase } from './supabase';

export interface CachedItem<T> {
  payload: T;
  generatedAt: string;
  cached: boolean;
}

const TTL: Record<string, number> = {
  morning_brief: 86_400,
  news_feed: 43_200,
  suggested_reads: 604_800,
  calendar_context: 3_600,
  music_artwork: 2_592_000,
  rich_recs: 86_400,
};

function redisKey(googleSub: string, contentType: string): string {
  return `wagwan:${googleSub}:${contentType}`;
}

export async function getCached<T>(
  googleSub: string,
  contentType: string,
): Promise<CachedItem<T> | null> {
  const rKey = redisKey(googleSub, contentType);

  const redis = await redisGetJson<{ payload: T; generatedAt: string }>(rKey);
  if (redis) {
    return { payload: redis.payload, generatedAt: redis.generatedAt, cached: true };
  }

  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from('cached_content')
      .select('payload, generated_at')
      .eq('google_sub', googleSub)
      .eq('content_type', contentType)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (data) {
      const item = { payload: data.payload as T, generatedAt: data.generated_at };
      const ttl = TTL[contentType] ?? 86_400;
      await redisSetJson(rKey, item, ttl);
      return { ...item, cached: true };
    }
  } catch {
    // cache miss
  }

  return null;
}

export async function setCached<T>(
  googleSub: string,
  contentType: string,
  payload: T,
): Promise<void> {
  const now = new Date().toISOString();
  const ttl = TTL[contentType] ?? 86_400;
  const rKey = redisKey(googleSub, contentType);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  await redisSetJson(rKey, { payload, generatedAt: now }, ttl);

  try {
    const sb = getServiceSupabase();
    await sb.from('cached_content').upsert(
      {
        google_sub: googleSub,
        content_type: contentType,
        payload: payload as any,
        generated_at: now,
        expires_at: expiresAt,
      },
      { onConflict: 'google_sub,content_type' },
    );
  } catch (e) {
    console.error('[contentCache] Supabase upsert error:', e);
  }
}

export async function invalidateCached(
  googleSub: string,
  contentType: string,
): Promise<void> {
  await redisDel(redisKey(googleSub, contentType));
  try {
    const sb = getServiceSupabase();
    await sb
      .from('cached_content')
      .delete()
      .eq('google_sub', googleSub)
      .eq('content_type', contentType);
  } catch {}
}

export async function invalidateAllCached(googleSub: string): Promise<void> {
  for (const type of Object.keys(TTL)) {
    await invalidateCached(googleSub, type);
  }
}
