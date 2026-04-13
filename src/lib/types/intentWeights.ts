/**
 * Intent types for dynamic platform weighting (behavioral engine).
 * Safe for client + server.
 */

export const INTENT_TYPES = ['action', 'purchase', 'identity', 'taste', 'growth'] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

/** Buckets aligned with weight matrix columns (Google vs YouTube split when possible). */
export const PLATFORM_BUCKETS = [
  'google',
  'youtube',
  'linkedin',
  'instagram',
  'music',
  'manual',
] as const;
export type PlatformBucket = (typeof PLATFORM_BUCKETS)[number];

/**
 * Platform weight by intent (from behavioral spec).
 * `manual` is not in the original matrix — use moderate self-report trust.
 */
export const INTENT_PLATFORM_WEIGHTS: Record<IntentType, Record<PlatformBucket, number>> = {
  action: {
    google: 0.9,
    youtube: 0.85,
    linkedin: 0.8,
    instagram: 0.7,
    music: 0.3,
    manual: 0.65,
  },
  purchase: {
    google: 0.95,
    youtube: 0.85,
    instagram: 0.75,
    linkedin: 0.6,
    music: 0.4,
    manual: 0.7,
  },
  identity: {
    instagram: 0.85,
    linkedin: 0.8,
    youtube: 0.7,
    google: 0.6,
    music: 0.65,
    manual: 0.75,
  },
  taste: {
    music: 0.95,
    instagram: 0.8,
    youtube: 0.75,
    google: 0.6,
    linkedin: 0.4,
    manual: 0.72,
  },
  growth: {
    instagram: 0.85,
    linkedin: 0.8,
    google: 0.75,
    youtube: 0.7,
    music: 0.4,
    manual: 0.68,
  },
};

/** Default intent for `final_score` (backward compatible with identity graph thresholds). */
export const DEFAULT_SIGNAL_INTENT_FOR_FINAL_SCORE: IntentType = 'identity';

export function intentWeightForPlatform(intent: IntentType, platform: PlatformBucket): number {
  const row = INTENT_PLATFORM_WEIGHTS[intent];
  return row[platform] ?? 0.65;
}

export function averageIntentWeightsAcrossPlatforms(
  intent: IntentType,
  platforms: PlatformBucket[],
): number {
  if (!platforms.length) return intentWeightForPlatform(intent, 'manual');
  const sum = platforms.reduce((acc, p) => acc + intentWeightForPlatform(intent, p), 0);
  return sum / platforms.length;
}
