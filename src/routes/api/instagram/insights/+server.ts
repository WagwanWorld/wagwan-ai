import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { computeInstagramInsights } from '$lib/server/instagramInsights';

export const GET: RequestHandler = async ({ url }) => {
  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) throw error(400, 'missing sub');

  const insights = await computeInstagramInsights(sub);
  if (!insights) {
    return json({ ok: false, error: 'instagram_not_connected_or_fetch_failed', insights: null });
  }
  return json({ ok: true, insights });
};
