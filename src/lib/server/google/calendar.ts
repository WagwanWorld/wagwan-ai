/**
 * Google Calendar fetch + deterministic signal extraction.
 */

export type CalendarEventType = 'fitness' | 'food_social' | 'work' | 'travel' | 'other';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  allDay: boolean;
  recurrence?: string[];
}

export interface CalendarIntentEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: CalendarEventType;
  location?: string;
}

export interface CalendarSignals {
  upcoming_events: CalendarIntentEvent[];
  habits: { title: string; pattern: string; type: CalendarEventType }[];
  lifestyle: {
    events_per_day_avg: number;
    work_vs_personal_ratio: number;
    social_frequency: 'low' | 'mid' | 'high';
    dominant_types: CalendarEventType[];
  };
  time_pattern: {
    active_hours_peak: number;
    late_night_events: number;
    early_morning_events: number;
  };
  intent: {
    next_24h: CalendarIntentEvent[];
    next_48h: CalendarIntentEvent[];
  };
}

const FITNESS = /\b(gym|workout|run|running|yoga|pilates|crossfit|lift|training|swim)\b/i;
const FOOD_SOCIAL = /\b(dinner|lunch|brunch|breakfast|cafe|coffee|drinks|party|birthday|celebration)\b/i;
const WORK = /\b(meeting|call|standup|sync|interview|1:1|workshop|presentation|demo|office)\b/i;
const TRAVEL = /\b(flight|trip|travel|hotel|check-?in|airport|train|uber to|vacation)\b/i;

export function classifyEventTitle(title: string): CalendarEventType {
  const t = title.toLowerCase();
  if (TRAVEL.test(t)) return 'travel';
  if (FITNESS.test(t)) return 'fitness';
  if (WORK.test(t)) return 'work';
  if (FOOD_SOCIAL.test(t)) return 'food_social';
  return 'other';
}

function eventStartMs(e: CalendarEvent): number {
  const d = new Date(e.start);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function toIntentEvent(e: CalendarEvent): CalendarIntentEvent {
  return {
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    type: classifyEventTitle(e.title),
    location: e.location,
  };
}

export async function fetchCalendarEvents(token: string, daysAhead = 7): Promise<CalendarEvent[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const future = new Date(todayStart.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: todayStart.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('[Calendar API]', res.status, errText);
    throw new Error(`Calendar API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return (data.items ?? []).map(
    (e: {
      id?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      location?: string;
      recurrence?: string[];
    }) => ({
      id: e.id ?? crypto.randomUUID(),
      title: e.summary ?? 'Untitled',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      location: e.location,
      allDay: !e.start?.dateTime,
      recurrence: e.recurrence,
    }),
  );
}

export function extractCalendarSignals(events: CalendarEvent[], now: Date = new Date()): CalendarSignals {
  const sorted = [...events].filter(e => e.start).sort((a, b) => eventStartMs(a) - eventStartMs(b));
  const nowMs = now.getTime();
  const in48h = nowMs + 48 * 60 * 60 * 1000;
  const in24h = nowMs + 24 * 60 * 60 * 1000;

  const upcoming = sorted.filter(e => eventStartMs(e) >= nowMs - 15 * 60 * 1000).map(toIntentEvent);

  const next48 = upcoming.filter(e => new Date(e.start).getTime() <= in48h);
  const next24 = next48.filter(e => new Date(e.start).getTime() <= in24h);

  const byDay = new Map<string, number>();
  let workish = 0;
  let personalish = 0;
  let socialish = 0;
  const hourCounts = new Array(24).fill(0);
  let lateNight = 0;
  let earlyMorning = 0;

  for (const e of sorted) {
    const start = new Date(e.start);
    if (Number.isNaN(start.getTime())) continue;
    const dayKey = start.toISOString().slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + 1);

    const type = classifyEventTitle(e.title);
    if (type === 'work') workish += 1;
    else if (type !== 'other') personalish += 1;
    if (type === 'food_social') socialish += 1;

    if (!e.allDay) {
      const h = start.getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
      if (h >= 22 || h < 5) lateNight += 1;
      if (h >= 5 && h < 8) earlyMorning += 1;
    }
  }

  const daysWithEvents = Math.max(1, byDay.size);
  const eventsPerDayAvg = sorted.length / daysWithEvents;
  const totalTyped = workish + personalish || 1;
  const ratio = workish / totalTyped;

  let socialFreq: 'low' | 'mid' | 'high' = 'low';
  if (socialish >= 4) socialFreq = 'high';
  else if (socialish >= 2) socialFreq = 'mid';

  const typeCounts: Record<CalendarEventType, number> = {
    fitness: 0,
    food_social: 0,
    work: 0,
    travel: 0,
    other: 0,
  };
  for (const e of sorted) {
    typeCounts[classifyEventTitle(e.title)] += 1;
  }
  const dominant = (Object.entries(typeCounts) as [CalendarEventType, number][])
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  let peakHour = 9;
  let maxH = 0;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > maxH) {
      maxH = hourCounts[h];
      peakHour = h;
    }
  }

  const habits: CalendarSignals['habits'] = [];
  const seenHabit = new Set<string>();
  for (const e of sorted) {
    if (!e.recurrence?.length) continue;
    const key = `${e.title.toLowerCase().slice(0, 40)}`;
    if (seenHabit.has(key)) continue;
    seenHabit.add(key);
    habits.push({
      title: e.title.slice(0, 60),
      pattern: e.recurrence[0]?.slice(0, 80) ?? 'recurring',
      type: classifyEventTitle(e.title),
    });
  }
  habits.splice(8);

  return {
    upcoming_events: upcoming.slice(0, 15),
    habits,
    lifestyle: {
      events_per_day_avg: Math.round(eventsPerDayAvg * 10) / 10,
      work_vs_personal_ratio: Math.round(ratio * 100) / 100,
      social_frequency: socialFreq,
      dominant_types: dominant.length ? dominant : ['other'],
    },
    time_pattern: {
      active_hours_peak: peakHour,
      late_night_events: lateNight,
      early_morning_events: earlyMorning,
    },
    intent: {
      next_24h: next24,
      next_48h: next48,
    },
  };
}
