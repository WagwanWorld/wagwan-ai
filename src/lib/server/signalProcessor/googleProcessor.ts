/**
 * Merge calendar + Gmail + profile signals into a compact twin identity for UI and graph.
 */

import {
  fetchCalendarEvents,
  fetchPastCalendarEvents,
  extractCalendarSignals,
  extractLifestylePatterns,
  type CalendarSignals,
  type LifestylePatterns,
} from '$lib/server/google/calendar';
import {
  fetchGmailMessagesForSignals,
  extractGmailSignals,
  type GmailSignals,
} from '$lib/server/google/gmail';
import { fetchGoogleProfileSignals, type ProfileSignals } from '$lib/server/google/profile';
import type { GoogleTwin } from '$lib/utils';

function insightDedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const k = l.toLowerCase();
    if (!l.trim() || seen.has(k)) continue;
    seen.add(k);
    out.push(l);
    if (out.length >= 12) break;
  }
  return out;
}

export function processGoogleSignals(
  calendar: CalendarSignals,
  gmail: GmailSignals,
  profile: ProfileSignals,
  now: Date = new Date(),
  lifestylePatterns?: LifestylePatterns,
): GoogleTwin {
  const { lifestyle: calLife, time_pattern: timePat, intent, habits } = calendar;
  const spend = gmail.spending;

  let workIntensity: 'low' | 'mid' | 'high' = 'mid';
  if (calLife.work_vs_personal_ratio >= 0.55 && calLife.events_per_day_avg >= 2) workIntensity = 'high';
  else if (calLife.work_vs_personal_ratio <= 0.25 && calLife.events_per_day_avg <= 1.2) workIntensity = 'low';

  const fitnessConsistency: 'low' | 'mid' | 'high' =
    habits.filter(h => h.type === 'fitness').length >= 2
      ? 'high'
      : habits.some(h => h.type === 'fitness')
        ? 'mid'
        : 'low';

  const socialFrequency =
    calLife.social_frequency === 'high'
      ? 'high'
      : calLife.social_frequency === 'mid'
        ? 'mid'
        : 'low';

  const eventCount = calendar.upcoming_events.length;
  let structuredVsSpontaneous: 'structured' | 'mixed' | 'spontaneous' = 'mixed';
  if (eventCount >= 8 || calLife.events_per_day_avg >= 3) structuredVsSpontaneous = 'structured';
  else if (eventCount <= 2 && calLife.events_per_day_avg < 1) structuredVsSpontaneous = 'spontaneous';

  const next = intent.next_24h[0] ?? intent.next_48h[0];
  const nextEventTitle = next?.title;
  const nextEventStart = next?.start;

  const catEntries = Object.entries(spend.category_counts).sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  );
  const categoryFocus = catEntries[0]?.[0];

  const plansHint =
    intent.next_48h.length >= 3
      ? 'busy couple of days ahead'
      : intent.next_48h.length === 0
        ? 'open schedule soon'
        : 'something coming up';

  const insights: string[] = [];

  if (timePat.late_night_events >= 2) insights.push('You tend to have late-night activity on your schedule');
  if (timePat.early_morning_events >= 2) insights.push('You often start early');
  if (spend.band === 'high' || (categoryFocus === 'food_delivery' && spend.purchase_count_30d >= 5)) {
    insights.push('You spend often on food and deliveries');
  }
  if (categoryFocus === 'travel' || calLife.dominant_types.includes('travel')) {
    insights.push('Travel shows up a lot in your routine');
  }
  if (workIntensity === 'high') insights.push('You have a busy weekday-style schedule');
  if (calLife.social_frequency === 'high') insights.push('You go out socially fairly often');
  if (fitnessConsistency === 'high') insights.push('Fitness is a steady habit for you');
  if (structuredVsSpontaneous === 'structured') insights.push('Your calendar runs packed most weeks');
  if (structuredVsSpontaneous === 'spontaneous') insights.push('You keep lots of open time');
  if (profile.locale && profile.locale.startsWith('en')) {
    /* skip generic */
  }

  const weekend = now.getDay() === 0 || now.getDay() === 6;
  if (!weekend && calLife.events_per_day_avg >= 2.5) insights.push('Weekdays look full for you');
  if (weekend && intent.next_48h.some(e => e.type === 'food_social')) insights.push('Weekends often include social meals');

  return {
    lifestyle: {
      workIntensity,
      socialFrequency,
      fitnessConsistency,
      scheduleDensity: calLife.events_per_day_avg >= 2.5 ? 'high' : calLife.events_per_day_avg >= 1 ? 'mid' : 'low',
      dominantCalendarTypes: calLife.dominant_types,
    },
    intent: {
      nextEventTitle,
      nextEventStart,
      plansHint,
      next48hCount: intent.next_48h.length,
    },
    spending: {
      band: spend.band,
      categoryFocus,
      purchaseCount30d: spend.purchase_count_30d,
    },
    personality: {
      structuredVsSpontaneous,
    },
    insights: insightDedupe(insights),
    /** Serialized calendar intent for clients that do not refetch events */
    calendarIntent48h: intent.next_48h.map(e => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      type: e.type,
      location: e.location,
    })),
    topMerchantHints: gmail.brands.slice(0, 4).map((b: { name: string }) => b.name),
    ...(lifestylePatterns ? { lifestylePatterns } : {}),
  };
}

/** Full pipeline for OAuth callback / refresh (token must have calendar + gmail scope). */
export async function computeGoogleTwinForToken(accessToken: string, mergeCity?: string): Promise<GoogleTwin | null> {
  try {
    const now = new Date();
    const [events, pastEvents, gmailMsgs, prof] = await Promise.all([
      fetchCalendarEvents(accessToken, 14),
      fetchPastCalendarEvents(accessToken, 30),
      fetchGmailMessagesForSignals(accessToken),
      fetchGoogleProfileSignals(accessToken, mergeCity),
    ]);
    const calSig = extractCalendarSignals(events, now);
    const lifestylePatterns = extractLifestylePatterns(pastEvents);
    const gSig = extractGmailSignals(gmailMsgs);
    return processGoogleSignals(calSig, gSig, prof, now, lifestylePatterns);
  } catch (e) {
    console.error('[computeGoogleTwinForToken]', e);
    return null;
  }
}
