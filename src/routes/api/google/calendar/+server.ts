/**
 * GET  /api/google/calendar  — fetch upcoming events (read)
 * POST /api/google/calendar  — push a new event (write reminders)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchCalendarEvents, pushCalendarEvent, refreshGoogleToken } from '$lib/server/google';

export const GET: RequestHandler = async ({ request }) => {
  const token = request.headers.get('x-google-token');
  if (!token) { console.error('[Calendar] No token in request'); return json({ events: [], error: 'no_token' }); }
  try {
    const events = await fetchCalendarEvents(token, 3);
    console.log(`[Calendar] Fetched ${events.length} events today`);
    return json({ events });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Calendar] Fetch error:', msg);
    return json({ events: [], error: msg }, { status: 401 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { accessToken, refreshToken, event } = body as {
    accessToken: string;
    refreshToken: string;
    event: { title: string; start: string; end: string; description?: string };
  };

  if (!accessToken || !event?.title) return json({ ok: false }, { status: 400 });

  // Try with provided token; if 401, refresh once
  let token = accessToken;
  let result = await pushCalendarEvent(token, event);

  if (!result && refreshToken) {
    try {
      token = await refreshGoogleToken(refreshToken);
      result = await pushCalendarEvent(token, event);
    } catch { /* ignore */ }
  }

  return json({ ok: !!result, eventId: result?.id, newToken: token !== accessToken ? token : undefined });
};
