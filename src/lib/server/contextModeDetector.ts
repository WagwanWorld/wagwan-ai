/**
 * The same person has different identities at different times.
 * Detects context mode and provides recommendation bias.
 */

export type ContextMode = 'morning_professional' | 'evening_social' | 'weekend_exploration' | 'late_night' | 'default';

export interface ContextState {
  mode: ContextMode;
  confidence: number;
  recommendation_bias: {
    boost: string[];
    suppress: string[];
  };
}

export function detectContextMode(userTimezone?: string): ContextState {
  const tz = userTimezone ?? 'Asia/Kolkata';
  const now = new Date();
  const localHour = parseInt(new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: tz }).format(now));
  const dayName = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: tz }).format(now);
  const isWeekend = dayName === 'Sat' || dayName === 'Sun';

  if (localHour >= 6 && localHour < 12 && !isWeekend) {
    return { mode: 'morning_professional', confidence: 0.85,
      recommendation_bias: { boost: ['career', 'tools', 'news', 'productivity'], suppress: ['nightlife', 'late_dining'] } };
  }
  if (localHour >= 18 && localHour < 24 && !isWeekend) {
    return { mode: 'evening_social', confidence: 0.80,
      recommendation_bias: { boost: ['food', 'events', 'music', 'social'], suppress: ['career', 'tools'] } };
  }
  if (isWeekend) {
    return { mode: 'weekend_exploration', confidence: 0.75,
      recommendation_bias: { boost: ['travel', 'experiences', 'food', 'discovery'], suppress: ['work_tools'] } };
  }
  if (localHour >= 0 && localHour < 6) {
    return { mode: 'late_night', confidence: 0.70,
      recommendation_bias: { boost: ['music', 'entertainment', 'chill'], suppress: ['career', 'shopping'] } };
  }
  return { mode: 'default', confidence: 0.50, recommendation_bias: { boost: [], suppress: [] } };
}
