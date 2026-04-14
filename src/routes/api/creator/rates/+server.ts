import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRates, upsertRates } from '$lib/server/creatorMarketplace';

export const GET: RequestHandler = async ({ url }) => {
  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });
  const rates = await getRates(sub);
  return json({ ok: true, rates: rates ?? { ig_post_rate_inr: 0, ig_story_rate_inr: 0, ig_reel_rate_inr: 0, whatsapp_intro_rate_inr: 0, available: false } });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });
  const ok = await upsertRates(body.sub, body.rates ?? {});
  return json({ ok });
};
