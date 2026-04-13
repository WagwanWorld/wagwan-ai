import { createHash } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { isSupabaseConfigured } from '$lib/server/supabase';
import { buildContext } from '$lib/server/identityContext/buildContext';
import { redisGetJson, redisSetJson } from '$lib/server/redisCache';

function cacheKey(googleSub: string, query: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const h = createHash('sha256').update(`${query}\n${googleSub}`).digest('hex').slice(0, 20);
  return `wagwan:contextpack:v1:${googleSub}:${day}:${h}`;
}

/** POST /api/user/context/query — full query-aware compressed context pack. */
export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: { googleSub?: unknown; query?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!googleSub) return json({ ok: false, error: 'missing_google_sub' }, { status: 400 });
  if (!query) return json({ ok: false, error: 'missing_query' }, { status: 400 });

  const key = cacheKey(googleSub, query);
  const ttlRaw = env.CONTEXT_QUERY_REDIS_TTL_SEC;
  const ttlSec =
    ttlRaw != null && String(ttlRaw).trim() !== ''
      ? Math.min(Math.max(Number(ttlRaw), 30), 3600)
      : 120;

  type Cached = { ok: true; intent: string; context: Awaited<ReturnType<typeof buildContext>> };
  const cached = await redisGetJson<Cached>(key);
  if (cached?.ok && cached.context) {
    return json(cached);
  }

  const context = await buildContext(googleSub, query);
  if (!context) return json({ ok: false, error: 'profile_not_found' }, { status: 404 });

  const payload = { ok: true as const, intent: context.intent, context };
  void redisSetJson(key, payload, ttlSec);

  return json(payload);
};
