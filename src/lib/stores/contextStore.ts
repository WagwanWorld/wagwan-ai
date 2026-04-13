/**
 * Live context for greetings, match reasons, and Explore sorting.
 * Call updateTwinContextFromCalendar after fetching events (Home / Explore).
 */

import { writable, get } from 'svelte/store';
import type { CalendarEvent } from '$lib/server/google';

export interface TwinUiContext {
  now: Date;
  isWeekend: boolean;
  calendarEvents: CalendarEvent[];
  nextEvent: CalendarEvent | null;
  minutesUntilNext: number | null;
  greetingPeriod: 'morning' | 'afternoon' | 'evening';
}

function greetingPeriodFor(d: Date): TwinUiContext['greetingPeriod'] {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function nextEventFromList(events: CalendarEvent[], now: Date): { event: CalendarEvent | null; minutes: number | null } {
  const nowMs = now.getTime();
  const upcoming = [...events]
    .filter(e => e.start && new Date(e.start).getTime() >= nowMs - 5 * 60 * 1000)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const ev = upcoming[0] ?? null;
  if (!ev?.start) return { event: null, minutes: null };
  const diff = (new Date(ev.start).getTime() - nowMs) / 60000;
  return { event: ev, minutes: Math.round(diff) };
}

const initial: TwinUiContext = {
  now: new Date(),
  isWeekend: false,
  calendarEvents: [],
  nextEvent: null,
  minutesUntilNext: null,
  greetingPeriod: 'evening',
};

export const twinUiContext = writable<TwinUiContext>(initial);

let tickId: ReturnType<typeof setInterval> | undefined;

/** Pass full calendar list; store picks next upcoming event. */
export function updateTwinContextFromCalendar(events: CalendarEvent[]) {
  const now = new Date();
  const d = now.getDay();
  const { event, minutes } = nextEventFromList(events, now);
  twinUiContext.set({
    now,
    isWeekend: d === 0 || d === 6,
    calendarEvents: events,
    nextEvent: event,
    minutesUntilNext: minutes,
    greetingPeriod: greetingPeriodFor(now),
  });
}

export function startTwinContextClock() {
  if (typeof window === 'undefined') return;
  if (tickId) return;
  tickId = setInterval(() => {
    twinUiContext.update(c => {
      const now = new Date();
      const d = now.getDay();
      const { event, minutes } = nextEventFromList(c.calendarEvents, now);
      return {
        ...c,
        now,
        isWeekend: d === 0 || d === 6,
        nextEvent: event,
        minutesUntilNext: minutes,
        greetingPeriod: greetingPeriodFor(now),
      };
    });
  }, 60_000);
}

export function getCurrentContext(): TwinUiContext {
  return get(twinUiContext);
}
