import { getServiceSupabase, isSupabaseConfigured } from './supabase';

interface EventSignalRow {
  event_type: string;
  entity_category: string | null;
  entity_name: string | null;
  raw_query: string | null;
  created_at: string;
}

interface RecFeedbackRow {
  entity_category: string | null;
  action: string;
}

export interface FirstPartySignal {
  value: string;
  category: string;
  type: string;
  strength: number;
  confidence: number;
  recency: number;
  frequency: number;
  source: string;
  platform_buckets: string[];
  direction: string;
  context: string;
}

export async function getFirstPartySignals(googleSub: string): Promise<FirstPartySignal[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getServiceSupabase();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [searchRes, feedbackRes] = await Promise.all([
    supabase.from('event_signals').select('event_type, entity_category, raw_query, created_at')
      .eq('user_google_sub', googleSub)
      .eq('event_type', 'search')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('recommendation_feedback').select('entity_category, action')
      .eq('user_google_sub', googleSub)
      .gte('created_at', thirtyDaysAgo)
      .limit(500),
  ]);

  const signals: FirstPartySignal[] = [];

  // Search query intent signals
  const queryCategories = classifySearchQueries((searchRes.data ?? []) as EventSignalRow[]);
  for (const [category, freq] of Object.entries(queryCategories)) {
    signals.push({
      value: category, category: 'search_intent', type: 'intent',
      strength: 0.88, confidence: 0.93, recency: 1.0,
      frequency: Math.min(freq / 10, 1.0),
      source: 'wagwan_search', platform_buckets: ['manual'],
      direction: 'positive',
      context: `User searched for this category ${freq} times in last 30 days`,
    });
  }

  // Recommendation affinity signals
  const affinityMap = buildAffinityMap((feedbackRes.data ?? []) as RecFeedbackRow[]);
  for (const [category, score] of Object.entries(affinityMap)) {
    if (Math.abs(score) < 0.1) continue;
    signals.push({
      value: category, category: 'recommendation_affinity',
      type: score > 0 ? 'interest' : 'behavior',
      strength: Math.abs(score), confidence: 0.90, recency: 1.0, frequency: 0.7,
      direction: score > 0 ? 'positive' : 'negative',
      source: 'wagwan_feedback', platform_buckets: ['manual'],
      context: `Inferred from ${score > 0 ? 'click/save' : 'dismiss'} behavior on recommendations`,
    });
  }

  return signals;
}

function classifySearchQueries(events: EventSignalRow[]): Record<string, number> {
  const PATTERNS: Array<{ regex: RegExp; category: string }> = [
    { regex: /restaurant|food|eat|dinner|lunch|cafe|coffee/i, category: 'food_dining' },
    { regex: /concert|event|show|festival|ticket|gig/i, category: 'live_events' },
    { regex: /buy|shop|price|deal|discount|order/i, category: 'shopping_intent' },
    { regex: /job|hiring|role|salary|career|internship/i, category: 'career_seeking' },
    { regex: /travel|flight|hotel|trip|vacation|weekend/i, category: 'travel_planning' },
    { regex: /workout|gym|yoga|run|fitness|health/i, category: 'fitness_wellness' },
  ];
  const counts: Record<string, number> = {};
  for (const ev of events) {
    const q = ev.raw_query ?? '';
    for (const { regex, category } of PATTERNS) {
      if (regex.test(q)) counts[category] = (counts[category] ?? 0) + 1;
    }
  }
  return counts;
}

function buildAffinityMap(feedback: RecFeedbackRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const fb of feedback) {
    const cat = fb.entity_category ?? 'unknown';
    const delta = fb.action === 'click' ? 0.15 : fb.action === 'save' ? 0.25 :
                  fb.action === 'share' ? 0.35 : fb.action === 'dismiss' ? -0.20 : 0;
    map[cat] = (map[cat] ?? 0) + delta;
  }
  const max = Math.max(...Object.values(map).map(Math.abs), 1);
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v / max]));
}
