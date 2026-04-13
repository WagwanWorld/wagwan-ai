import { getTokens, updateTokens } from '$lib/server/supabase';
import {
  refreshGoogleToken,
  fetchGmailSummary,
  fetchCalendarEvents,
} from '$lib/server/google';
import { extractCalendarSignals } from '$lib/server/google/calendar';

export async function resolveGoogleAccessToken(googleSub: string): Promise<string | null> {
  const tokens = await getTokens(googleSub);
  let access = tokens.googleAccessToken?.trim();
  const refresh = tokens.googleRefreshToken?.trim();
  if (access) return access;
  if (!refresh) return null;
  try {
    access = await refreshGoogleToken(refresh);
    await updateTokens(googleSub, { googleAccessToken: access });
    return access;
  } catch {
    return null;
  }
}

/** Refresh access token if a Google API call likely failed auth. */
export async function refreshAndStoreAccessToken(googleSub: string): Promise<string | null> {
  const tokens = await getTokens(googleSub);
  const refresh = tokens.googleRefreshToken?.trim();
  if (!refresh) return null;
  try {
    const access = await refreshGoogleToken(refresh);
    await updateTokens(googleSub, { googleAccessToken: access });
    return access;
  } catch {
    return null;
  }
}

export async function buildGmailContext(googleSub: string): Promise<string> {
  const token = await resolveGoogleAccessToken(googleSub);
  if (!token) return 'Gmail: not connected (no Google tokens).';

  try {
    const { threads, senders } = await fetchGmailSummary(token);
    if (!threads.length) return 'Gmail: no recent inbox threads in the last 24h (or inbox empty).';
    return `Gmail (last ~24h, subject lines and senders):\nSubjects:\n${threads.map(t => `- ${t}`).join('\n')}\nSenders: ${senders.join(', ')}`;
  } catch {
    const t2 = await refreshAndStoreAccessToken(googleSub);
    if (!t2) return 'Gmail: could not fetch (auth failed).';
    try {
      const { threads, senders } = await fetchGmailSummary(t2);
      if (!threads.length) return 'Gmail: no recent threads.';
      return `Gmail (last ~24h):\n${threads.map(s => `- ${s}`).join('\n')}\nSenders: ${senders.join(', ')}`;
    } catch (e) {
      return `Gmail: error ${e instanceof Error ? e.message : 'unknown'}`;
    }
  }
}

export async function buildCalendarContext(googleSub: string): Promise<string> {
  const token = await resolveGoogleAccessToken(googleSub);
  if (!token) return 'Calendar: not connected (no Google tokens).';

  try {
    const events = await fetchCalendarEvents(token, 7);
    const signals = extractCalendarSignals(events, new Date());
    const next = signals.intent.next_24h.slice(0, 5);
    const nextLines = next.map(
      e => `- ${e.title} | ${e.start}${e.location ? ` @ ${e.location}` : ''} (${e.type})`,
    );
    return `Calendar (next 7 days, condensed):\nNext 24h:\n${nextLines.length ? nextLines.join('\n') : '(none)'}\nNext 48h events: ${signals.intent.next_48h.length}\nUpcoming sample: ${signals.upcoming_events.slice(0, 4).map(e => e.title).join('; ')}`;
  } catch {
    const t2 = await refreshAndStoreAccessToken(googleSub);
    if (!t2) return 'Calendar: could not fetch (auth failed).';
    try {
      const events = await fetchCalendarEvents(t2, 7);
      const signals = extractCalendarSignals(events, new Date());
      const next = signals.intent.next_24h.slice(0, 6);
      return `Calendar:\n${next.map(e => `- ${e.title} @ ${e.start}`).join('\n') || '(no events in 24h)'}`;
    } catch (e) {
      return `Calendar: error ${e instanceof Error ? e.message : 'unknown'}`;
    }
  }
}
