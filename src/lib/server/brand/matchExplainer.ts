import type { MatchResult, BrandQueryIntent, ExpandedSignal, WeightedSignal, CohortSignalReport } from './types';

export function generateMatchExplanation(
  user: MatchResult,
  intent: BrandQueryIntent,
  _expandedSignals: ExpandedSignal[]
): string {
  const tier = user.match_tier;
  const correlatedSignals = user.correlation_paths ?? [];

  if (tier === 1) {
    const sig = user.matched_signals[0] as any;
    const val = sig?.value ?? sig?.claim_assertion ?? 'target signal';
    return `Direct match: user explicitly has '${val}' in their identity profile (score: ${user.match_score.toFixed(2)}).`;
  }
  if (tier === 2) {
    const target = intent.target_interests?.[0] ?? 'target profile';
    return `Inferred match: behavioral analysis indicates strong alignment with '${target}'. Confidence: ${(user.match_confidence * 100).toFixed(0)}%.`;
  }
  if (tier === 3) {
    const sig = user.matched_signals[0] as any;
    const pattern = sig?.behavioral_pattern ?? sig?.value ?? 'behavioral pattern';
    return `Behavioral match: user shows '${pattern}' pattern, consistent with your target customer.`;
  }
  if (tier === 4 && correlatedSignals.length > 0) {
    const path = correlatedSignals[0];
    return `Correlation match: user has strong '${path.from}' signal. ${((path.confidence ?? 0) * 100).toFixed(0)}% of users with '${path.from}' also match '${path.to}' (lift: ${path.lift?.toFixed(1)}x). Score: ${user.match_score.toFixed(2)}.`;
  }
  return `Loose association match: user shares contextual patterns with your target audience.`;
}

export function findDifferentiatingSignals(
  cohortUsers: MatchResult[],
  otherUsers: MatchResult[]
): WeightedSignal[] {
  const cohortSignalCounts = new Map<string, number>();
  const otherSignalCounts = new Map<string, number>();

  for (const u of cohortUsers) {
    for (const sig of u.matched_signals as any[]) {
      const key = sig?.value ?? '';
      if (key) cohortSignalCounts.set(key, (cohortSignalCounts.get(key) ?? 0) + 1);
    }
  }
  for (const u of otherUsers) {
    for (const sig of u.matched_signals as any[]) {
      const key = sig?.value ?? '';
      if (key) otherSignalCounts.set(key, (otherSignalCounts.get(key) ?? 0) + 1);
    }
  }

  const differentiators: WeightedSignal[] = [];
  for (const [signal, count] of cohortSignalCounts) {
    const cohortRate = count / Math.max(cohortUsers.length, 1);
    const otherRate = (otherSignalCounts.get(signal) ?? 0) / Math.max(otherUsers.length, 1);
    const lift = cohortRate / Math.max(otherRate, 0.01);
    if (lift > 1.5) {
      differentiators.push({ value: signal, category: 'differentiator', final_score: lift });
    }
  }
  return differentiators.sort((a, b) => b.final_score - a.final_score).slice(0, 5);
}

export function buildCohortSignalReport(
  cohortUsers: MatchResult[],
  allCohortUsers: Map<string, MatchResult[]>,
  intent: BrandQueryIntent
): CohortSignalReport {
  const targetSignals = [
    ...(intent.target_genres ?? []),
    ...(intent.target_aesthetics ?? []),
    ...(intent.target_interests ?? []),
    ...(intent.target_artists ?? []),
  ];

  const coverage: Record<string, number> = {};
  for (const sig of targetSignals) {
    const count = cohortUsers.filter(u =>
      u.matched_signals.some((s: any) =>
        (s.value ?? s.claim_assertion ?? '').toLowerCase().includes(sig.toLowerCase())
      )
    ).length;
    coverage[sig] = cohortUsers.length > 0 ? count / cohortUsers.length : 0;
  }

  const otherUsers = [...allCohortUsers.values()].flat().filter(u => !cohortUsers.includes(u));
  const differentiators = findDifferentiatingSignals(cohortUsers, otherUsers);

  return { coverage, differentiators, total_users: cohortUsers.length };
}
