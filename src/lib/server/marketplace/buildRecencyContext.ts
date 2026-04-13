/**
 * Compact recency slice for the identity intelligence layer (sync stamps + refresh deltas).
 */

export type RecencyBucket = 'within_24h' | 'within_7d' | 'older' | 'unknown';

function bucketForIso(iso: string | undefined, nowMs: number): RecencyBucket {
  if (!iso?.trim()) return 'unknown';
  const t = Date.parse(iso.trim());
  if (!Number.isFinite(t)) return 'unknown';
  const delta = nowMs - t;
  const h24 = 24 * 60 * 60 * 1000;
  const d7 = 7 * h24;
  if (delta < 0) return 'within_24h';
  if (delta <= h24) return 'within_24h';
  if (delta <= d7) return 'within_7d';
  return 'older';
}

export interface BuildRecencyContextInput {
  profileData: Record<string, unknown>;
  /** Keys updated during this refresh run (e.g. instagramIdentity). */
  updatedPlatformKeys: string[];
  /** When false, omit heavy media snippets; still include sync classification. */
  includeMicroSignals?: boolean;
}

/**
 * Returns a short markdown-ish block for the LLM user message.
 */
export function buildRecencyContext(input: BuildRecencyContextInput): string {
  const nowMs = Date.now();
  const { profileData, updatedPlatformKeys, includeMicroSignals = true } = input;

  const profileUpdatedAt =
    typeof profileData.profileUpdatedAt === 'string' ? profileData.profileUpdatedAt.trim() : '';
  const meta = profileData.signalSyncMeta as Record<string, unknown> | undefined;

  const platformBuckets: Record<string, RecencyBucket> = {};
  if (meta && typeof meta === 'object') {
    for (const [k, v] of Object.entries(meta)) {
      platformBuckets[k] = bucketForIso(typeof v === 'string' ? v : '', nowMs);
    }
  }

  const lines: string[] = [
    '## Recency (signal syncs vs now)',
    `- profile_updated_at_bucket: ${bucketForIso(profileUpdatedAt, nowMs)}${
      profileUpdatedAt ? ` (iso: ${profileUpdatedAt})` : ''
    }`,
    `- platforms_sync_buckets: ${JSON.stringify(platformBuckets)}`,
    `- this_refresh_updated_identity_keys: ${JSON.stringify(updatedPlatformKeys)}`,
  ];

  if (includeMicroSignals) {
    const am = profileData.appleMusicIdentity as
      | { recentlyPlayed?: Array<{ title?: string; artistName?: string }> }
      | undefined;
    const recentTracks = am?.recentlyPlayed?.slice(0, 5) ?? [];
    if (recentTracks.length) {
      lines.push(
        '- apple_music_recently_played_sample:',
        ...recentTracks.map(
          t => `  - ${String(t.title ?? '')} — ${String(t.artistName ?? '')}`.trim(),
        ),
      );
    }
  }

  return lines.join('\n');
}
