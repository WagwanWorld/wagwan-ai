/**
 * GET /api/home/artist-artwork?artists=name1,name2,...
 *
 * Returns iTunes artwork URLs, cached in Redis for 30 days.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { redisGetJson, redisSetJson } from '$lib/server/redisCache';
import { getArtistArtwork } from '$lib/client/itunesArtwork';

const REDIS_TTL = 2_592_000; // 30 days

export const GET: RequestHandler = async ({ url }) => {
  const raw = url.searchParams.get('artists') || '';
  const names = raw.split(',').map(n => n.trim()).filter(Boolean).slice(0, 10);
  if (!names.length) return json({ ok: true, artwork: {} });

  const result: Record<string, string> = {};

  await Promise.all(names.map(async (name) => {
    const rKey = `wagwan:artwork:${name.toLowerCase()}`;

    const cached = await redisGetJson<string>(rKey);
    if (cached) {
      result[name] = cached;
      return;
    }

    const artUrl = await getArtistArtwork(name);
    if (artUrl) {
      result[name] = artUrl;
      await redisSetJson(rKey, artUrl, REDIS_TTL);
    }
  }));

  return json({ ok: true, artwork: result });
};
