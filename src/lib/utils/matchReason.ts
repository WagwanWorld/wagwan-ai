import type { ResultCard, GoogleTwin } from '$lib/utils';
import type { TwinUiContext } from '$lib/stores/contextStore';

const GENERIC = /^pulled from live search|here are|i found|some options/i;

function nextEventClause(ctx: TwinUiContext): string | null {
  if (!ctx.nextEvent?.title) return null;
  if (ctx.minutesUntilNext != null && ctx.minutesUntilNext >= 0 && ctx.minutesUntilNext < 90) {
    return 'Close to your next commitment';
  }
  return 'Fits around your plans';
}

function twinClause(twin: GoogleTwin | null | undefined): string | null {
  if (!twin) return null;
  if (twin.spending?.categoryFocus === 'food_delivery') return 'Matches your dining habits';
  if (twin.lifestyle?.dominantCalendarTypes?.includes('fitness')) return 'Lines up with how you move';
  if (twin.lifestyle?.dominantCalendarTypes?.includes('travel')) return 'Suits your travel streak';
  if (twin.personality?.structuredVsSpontaneous === 'structured') return 'Fits a tight schedule';
  if (twin.personality?.structuredVsSpontaneous === 'spontaneous') return 'Easy to slot in spontaneously';
  return null;
}

export function ensureMatchReason(
  card: ResultCard,
  twin: GoogleTwin | null | undefined,
  ctx: TwinUiContext,
): ResultCard {
  const reason = (card.match_reason ?? '').trim();
  if (reason && !GENERIC.test(reason)) return card;

  const parts = [nextEventClause(ctx), twinClause(twin)].filter(Boolean);
  const fallback =
    parts[0] ??
    (card.category === 'food'
      ? 'Fits your usual tastes'
      : card.category === 'music'
        ? 'Matches your listening vibe'
        : 'Picked for your profile');

  return { ...card, match_reason: fallback };
}

export function ensureMatchReasons(
  cards: ResultCard[],
  twin: GoogleTwin | null | undefined,
  ctx: TwinUiContext,
): ResultCard[] {
  return cards.map(c => ensureMatchReason(c, twin, ctx));
}
