// src/lib/server/brandTrajectory.ts
//
// Computes trends from brand_snapshots: week-over-week deltas,
// rolling averages, anomaly detection, audience drift.

import Anthropic from '@anthropic-ai/sdk';

export interface MetricDelta {
  metric: string;
  current: number;
  previous: number;
  deltaPct: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TrajectoryResult {
  deltas: MetricDelta[];
  anomalies: Array<{ metric: string; message: string; severity: 'high' | 'medium' }>;
  audienceDrift: string; // narrative or "stable"
  fourWeekTrends: Record<string, number[]>; // metric -> [w1, w2, w3, w4]
}

function delta(curr: number, prev: number): { deltaPct: number; trend: 'up' | 'down' | 'stable' } {
  if (prev === 0) return { deltaPct: 0, trend: 'stable' };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { deltaPct: pct, trend: pct > 2 ? 'up' : pct < -2 ? 'down' : 'stable' };
}

export function computeTrajectory(
  current: Record<string, unknown>,
  previous: Record<string, unknown> | null,
  history: Array<Record<string, unknown>>, // last 4 snapshots, newest first
): TrajectoryResult {
  const result: TrajectoryResult = {
    deltas: [],
    anomalies: [],
    audienceDrift: 'stable',
    fourWeekTrends: {},
  };

  if (!previous) return result;

  // Compute deltas for key metrics
  const metricKeys = [
    'followers', 'engagement_rate', 'avg_saves', 'avg_shares',
    'avg_reach', 'impressions_7d', 'reach_7d', 'profile_views_7d', 'posts_per_week',
  ];

  for (const key of metricKeys) {
    const curr = Number((current as any)[key] || 0);
    const prev = Number((previous as any)[key] || 0);
    const { deltaPct, trend } = delta(curr, prev);
    const label = key.replace(/_/g, ' ').replace(/7d/g, '(7d)');
    result.deltas.push({ metric: label, current: curr, previous: prev, deltaPct, trend });

    // Anomaly: >30% change in either direction
    if (Math.abs(deltaPct) > 30) {
      result.anomalies.push({
        metric: label,
        message: `${label} ${deltaPct > 0 ? 'surged' : 'dropped'} ${Math.abs(deltaPct)}% week-over-week`,
        severity: Math.abs(deltaPct) > 50 ? 'high' : 'medium',
      });
    }
  }

  // 4-week rolling trends
  for (const key of metricKeys) {
    result.fourWeekTrends[key] = history.slice(0, 4).map(s => Number((s as any)[key] || 0));
  }

  // Audience drift detection
  const currDemo = (current as any).demographics;
  const prevDemo = (previous as any).demographics;
  if (currDemo && prevDemo) {
    const currCities = (currDemo.topCities || []).map((c: any) => c.city);
    const prevCities = (prevDemo.topCities || []).map((c: any) => c.city);
    const newCities = currCities.filter((c: string) => !prevCities.includes(c));

    const currAge = currDemo.ageBuckets || {};
    const prevAge = prevDemo.ageBuckets || {};
    const ageDrifts: string[] = [];
    for (const bucket of Object.keys(currAge)) {
      const diff = (currAge[bucket] || 0) - (prevAge[bucket] || 0);
      if (Math.abs(diff) >= 3) {
        ageDrifts.push(`${bucket}: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
      }
    }

    if (newCities.length > 0 || ageDrifts.length > 0) {
      const parts: string[] = [];
      if (newCities.length > 0) parts.push(`New cities in top 10: ${newCities.join(', ')}`);
      if (ageDrifts.length > 0) parts.push(`Age shifts: ${ageDrifts.join(', ')}`);
      result.audienceDrift = parts.join('. ');
    }
  }

  return result;
}

export async function generateWeeklyBrief(
  trajectory: TrajectoryResult,
  intelligence: Record<string, unknown>,
  profile: { username: string; name: string; followers_count: number },
  apiKey: string,
): Promise<{ headline: string; sections: Record<string, string>; keyMetrics: MetricDelta[] }> {
  const fallback = {
    headline: 'Weekly intelligence update',
    sections: { whats_working: '', whats_not: '', audience_shift: trajectory.audienceDrift, competitor_moves: '', recommended_moves: '' },
    keyMetrics: trajectory.deltas,
  };

  try {
    const client = new Anthropic({ apiKey });
    const metricsSummary = trajectory.deltas
      .filter(d => d.trend !== 'stable')
      .map(d => `${d.metric}: ${d.deltaPct > 0 ? '+' : ''}${d.deltaPct}% (${d.previous} → ${d.current})`)
      .join('\n');

    const anomalySummary = trajectory.anomalies.length > 0
      ? trajectory.anomalies.map(a => `[${a.severity}] ${a.message}`).join('\n')
      : 'No anomalies this week.';

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Write a weekly brand intelligence brief. Return ONLY valid JSON.

Brand: @${profile.username} — ${profile.name} (${profile.followers_count} followers)

Metric changes this week:
${metricsSummary || 'All metrics stable.'}

Anomalies:
${anomalySummary}

Audience drift: ${trajectory.audienceDrift}

Return:
{
  "headline": "Punchy 1-line headline summarising the week (like a magazine headline)",
  "sections": {
    "whats_working": "2-3 sentences on positive trends",
    "whats_not": "2-3 sentences on concerns or declining metrics",
    "audience_shift": "1-2 sentences on demographic changes or 'Audience composition stable this week'",
    "competitor_moves": "1-2 sentences or 'No competitor data yet'",
    "recommended_moves": "2-3 bullet-point recommendations"
  }
}`
      }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return { ...parsed, keyMetrics: trajectory.deltas };
  } catch {
    return fallback;
  }
}
