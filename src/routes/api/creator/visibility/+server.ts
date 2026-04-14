import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getVisibility, upsertVisibility } from '$lib/server/creatorMarketplace';

export const GET: RequestHandler = async ({ url }) => {
  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });
  const vis = await getVisibility(sub);
  return json({ ok: true, visibility: vis ?? { music_visible: true, instagram_visible: true, career_visible: true, lifestyle_visible: true, calendar_visible: false, email_visible: false } });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });
  const ok = await upsertVisibility(body.sub, body.visibility ?? {});
  return json({ ok });
};
