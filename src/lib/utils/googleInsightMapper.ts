import type { GoogleTwin } from '$lib/utils';
import type { TwinUiContext } from '$lib/stores/contextStore';
import type { CalendarEvent } from '$lib/server/google';

function fmtEventTime(e: CalendarEvent): string {
  if (e.allDay) return 'all day';
  try {
    return new Date(e.start).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function greetingWord(ctx: TwinUiContext): string {
  switch (ctx.greetingPeriod) {
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    default:
      return 'Good evening';
  }
}

/** Two-line latch greeting: compact headline + conversational subline (human tone). */
export function buildHomeLatchGreeting(
  name: string,
  ctx: TwinUiContext,
): { line1: string; line2: string } {
  const first = name.split(/\s+/)[0] || 'there';
  const g = greetingWord(ctx);
  const ev = ctx.nextEvent;
  if (ev?.title) {
    const t = fmtEventTime(ev);
    return {
      line1: `${g}, ${first}`,
      line2: t
        ? `You've got ${ev.title} at ${t} — what do you feel like doing till then?`
        : `You've got ${ev.title} coming up — what do you feel like doing till then?`,
    };
  }
  return {
    line1: `${g}, ${first}`,
    line2: 'What are you in the mood for? Tell me what you feel like.',
  };
}

/** Mandatory greeting line + whether we used event-specific copy. */
export function buildHomeGreeting(
  name: string,
  ctx: TwinUiContext,
): { line: string; usedEvent: boolean } {
  const g = greetingWord(ctx);
  const first = name.split(/\s+/)[0] || 'there';
  const ev = ctx.nextEvent;
  if (ev?.title && ev.start) {
    const t = fmtEventTime(ev);
    return {
      line: `${g}, ${first}. You have ${ev.title}${t ? ` at ${t}` : ''}.`,
      usedEvent: true,
    };
  }
  return {
    line: `${g}, ${first}. Here's what's happening today.`,
    usedEvent: false,
  };
}

export function buildHomeContextLine(twin: GoogleTwin | null | undefined, ctx: TwinUiContext): string {
  if (ctx.minutesUntilNext != null && ctx.minutesUntilNext >= 0 && ctx.minutesUntilNext < 180 && ctx.nextEvent) {
    if (ctx.minutesUntilNext < 60) return "You've got something coming up soon.";
    return "You've got a packed stretch ahead.";
  }
  if (twin?.lifestyle?.scheduleDensity === 'low') return 'Looks like a relaxed stretch.';
  if (twin?.lifestyle?.scheduleDensity === 'high') return "You've got a packed day ahead.";
  if (twin?.lifestyle?.socialFrequency === 'high') return 'You usually keep social time on the calendar.';
  if (ctx.isWeekend && twin?.intent?.next48hCount) return 'Weekend plans are on your radar.';
  return "Let's figure something out that fits your rhythm.";
}

export function buildExploreContextTags(
  twin: GoogleTwin | null | undefined,
  ctx: TwinUiContext,
): string[] {
  const tags: string[] = [];
  if (ctx.nextEvent) tags.push('Near your plans');
  if (twin?.intent?.next48hCount && twin.intent.next48hCount >= 2) tags.push('Around your calendar');
  if (ctx.minutesUntilNext != null && ctx.minutesUntilNext < 120) tags.push('Quick options');
  if (!tags.length) tags.push('Picked for you');
  return [...new Set(tags)].slice(0, 4);
}

export function buildProfileTwinKnows(twin: GoogleTwin | null | undefined): string[] {
  if (!twin?.insights?.length) return [];
  return twin.insights.slice(0, 5);
}
