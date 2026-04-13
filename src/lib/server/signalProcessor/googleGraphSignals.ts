/**
 * Derived tags for identity_graph + brand flatten (rules-first, no extra LLM).
 */
type GoogleGraphInput = {
  topCategories?: string[];
  lifestyleSignals?: string[];
  emailThemes?: string[];
  twin?: import('$lib/utils').GoogleTwin;
} | null;

export function deriveGoogleSignalTags(google: GoogleGraphInput | undefined): string[] {
  if (!google) return [];
  const tags = new Set<string>();
  const add = (s: string) => {
    const t = s.trim().toLowerCase();
    if (t.length > 1) tags.add(t);
  };

  for (const c of google.topCategories ?? []) add(c);
  for (const s of google.lifestyleSignals ?? []) add(s);
  for (const th of google.emailThemes ?? []) add(th.replace(/\s+/g, '_'));

  const twin = google.twin;
  if (twin?.lifestyle?.dominantCalendarTypes?.length) {
    for (const x of twin.lifestyle.dominantCalendarTypes) add(`cal_${x}`);
  }
  if (twin?.lifestyle?.workIntensity === 'high') add('busy_work_calendar');
  if (twin?.spending?.categoryFocus) add(`commerce_${twin.spending.categoryFocus}`);
  if (twin?.spending?.band === 'high') add('active_online_spender');
  for (const m of twin?.topMerchantHints ?? []) add(`merchant_${m}`.replace(/\s+/g, '_').slice(0, 48));

  return [...tags];
}

export function deriveGoogleIntentHints(
  google: GoogleGraphInput | undefined,
): Array<{ intent: string; confidence: number; time_horizon?: string }> {
  if (!google?.twin) return [];
  const out: Array<{ intent: string; confidence: number; time_horizon?: string }> = [];
  const t = google.twin;

  if (t.intent?.next48hCount && t.intent.next48hCount >= 3) {
    out.push({ intent: 'busy_social_week', confidence: 0.7, time_horizon: '48h' });
  }
  if (t.lifestyle?.dominantCalendarTypes?.includes('travel')) {
    out.push({ intent: 'travel_planner', confidence: 0.68, time_horizon: '30_days' });
  }
  if (t.lifestyle?.dominantCalendarTypes?.includes('fitness')) {
    out.push({ intent: 'fitness_routine_google', confidence: 0.65, time_horizon: 'ongoing' });
  }
  if (t.spending?.categoryFocus === 'food_delivery' && t.spending.purchaseCount30d >= 4) {
    out.push({ intent: 'food_discovery', confidence: 0.62, time_horizon: 'ongoing' });
  }
  return out.slice(0, 5);
}
