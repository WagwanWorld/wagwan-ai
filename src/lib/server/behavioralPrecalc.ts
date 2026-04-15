/**
 * Deterministic precalc: intent classification, cross-platform themes, negative patterns.
 * Feeds LLM bundles and memory graph projection.
 */

import type { IdentityGraph } from '$lib/server/identity';
import type { SignalMeterOutput, WeightedSignal } from '$lib/types/signalMeter';
import {
  type IntentType,
  INTENT_TYPES,
  INTENT_PLATFORM_WEIGHTS,
} from '$lib/types/intentWeights';

export interface CrossPlatformTheme {
  theme: string;
  platforms: string[];
  tier: 2 | 3;
  /** Short label for bundles */
  label: string;
}

export interface NegativeSignalItem {
  pattern: string;
  implication: string;
  /** What this cautions against over-reading */
  dampens: string[];
}

export interface BehavioralPrecalcResult {
  primary_intent_type: IntentType;
  /** Heuristic 0–1 scores per intent (not probabilities). */
  intent_scores: Record<IntentType, number>;
  cross_platform_themes: CrossPlatformTheme[];
  negative_signals: NegativeSignalItem[];
  platform_connected: Record<string, boolean>;
  /** Human-readable summary for LLM context */
  intent_weight_matrix_applied: string;
  /** Deterministic momentum score 0–100 (replaces LLM-estimated value). */
  momentum_score: number;
  /** Change from prior momentum_score; 0 if no prior exists. */
  momentum_delta: number;
}

function normToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(texts: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of texts) {
    for (const w of normToken(t).split(' ')) {
      if (w.length >= 4) out.add(w);
    }
  }
  return out;
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) {
    if (b.has(x)) n++;
  }
  return n;
}

/**
 * Heuristic primary intent from graph + signal meter composition.
 */
function classifyIntent(
  graph: IdentityGraph,
  meter: SignalMeterOutput,
  mergedProfile: Record<string, unknown>,
): { primary: IntentType; scores: Record<IntentType, number> } {
  const scores = {} as Record<IntentType, number>;
  for (const k of INTENT_TYPES) scores[k] = 0.35;

  const g = mergedProfile.googleIdentity as Record<string, unknown> | undefined;
  const twin = g?.twin as Record<string, unknown> | undefined;
  const lifestyle = twin?.lifestyle as Record<string, unknown> | undefined;
  const spending = twin?.spending as Record<string, unknown> | undefined;
  const yt = mergedProfile.youtubeIdentity as Record<string, unknown> | undefined;

  const hasMusic =
    graph.topArtists.length > 0 ||
    graph.topGenres.length > 0 ||
    Boolean(mergedProfile.spotifyIdentity || mergedProfile.appleMusicIdentity);
  const hasIg = Boolean(mergedProfile.instagramIdentity);
  const hasLi = Boolean(mergedProfile.linkedinIdentity);
  const hasGoogle =
    Boolean(g) &&
    ((Array.isArray(g?.topChannels) && (g.topChannels as unknown[]).length > 0) ||
      (Array.isArray(g?.topCategories) && (g.topCategories as unknown[]).length > 0) ||
      (Array.isArray(g?.lifestyleSignals) && (g.lifestyleSignals as unknown[]).length > 0));
  const hasYt = Boolean(
    yt &&
      ((Array.isArray(yt.topChannels) && yt.topChannels.length > 0) ||
        (Array.isArray(yt.topCategories) && yt.topCategories.length > 0)),
  );

  const purchaseHints =
    (typeof spending?.categoryFocus === 'string' ? 1 : 0) +
    (graph.googleSignalTags.some(t => /shop|buy|deal|price|order/i.test(t)) ? 0.45 : 0) +
    (Array.isArray(g?.emailThemes) && (g!.emailThemes as string[]).some(e => /receipt|order|invoice/i.test(e))
      ? 0.35
      : 0);

  const tasteHints =
    (hasMusic ? 0.5 : 0) +
    (graph.brandVibes.length > 2 ? 0.2 : 0) +
    meter.signals.filter(s => s.type === 'taste').length * 0.04;

  const actionHints =
    (hasGoogle || hasYt ? 0.35 : 0) +
    (graph.lifestyleSignals.length > 2 ? 0.15 : 0) +
    (lifestyle?.dominantCalendarTypes ? 0.2 : 0) +
    meter.signals.filter(s => s.type === 'intent' || s.type === 'behavior').length * 0.03;

  const identityHints =
    (hasIg ? 0.35 : 0) +
    (hasLi ? 0.25 : 0) +
    (graph.rawSummarySnippet?.trim() ? 0.15 : 0);

  const growthHints =
    (graph.igCreatorTier && graph.igCreatorTier !== 'hobby' && graph.igCreatorTier !== 'private'
      ? 0.2
      : 0) +
    (graph.linkedinCareerSnippet?.length > 80 ? 0.15 : 0) +
    (hasLi && hasIg ? 0.2 : 0);

  scores.purchase = Math.min(1, 0.2 + purchaseHints * 0.25 + (hasGoogle ? 0.15 : 0));
  scores.taste = Math.min(1, 0.25 + tasteHints * 0.22);
  scores.action = Math.min(1, 0.25 + actionHints * 0.2);
  scores.identity = Math.min(1, 0.28 + identityHints * 0.22);
  scores.growth = Math.min(1, 0.28 + growthHints * 0.22);

  let primary: IntentType = 'identity';
  let best = 0;
  for (const k of INTENT_TYPES) {
    if (scores[k] > best) {
      best = scores[k];
      primary = k;
    }
  }
  return { primary, scores };
}

function extractCrossPlatformThemes(
  graph: IdentityGraph,
  mergedProfile: Record<string, unknown>,
): CrossPlatformTheme[] {
  const ig = mergedProfile.instagramIdentity as Record<string, unknown> | undefined;
  const li = mergedProfile.linkedinIdentity as Record<string, unknown> | undefined;
  const sp = mergedProfile.spotifyIdentity as Record<string, unknown> | undefined;
  const am = mergedProfile.appleMusicIdentity as Record<string, unknown> | undefined;
  const g = mergedProfile.googleIdentity as Record<string, unknown> | undefined;
  const yt = mergedProfile.youtubeIdentity as Record<string, unknown> | undefined;

  const bags: Array<{ name: string; texts: string[] }> = [];
  if (ig) {
    bags.push({
      name: 'instagram',
      texts: [
        String(ig.aesthetic ?? ''),
        String(ig.lifestyle ?? ''),
        ...((ig.interests as string[]) ?? []),
        ...((ig.brandVibes as string[]) ?? []),
        ...((ig.igInsightsTags as string[]) ?? []),
      ],
    });
  }
  if (li) {
    bags.push({
      name: 'linkedin',
      texts: [
        String(li.headline ?? ''),
        String(li.careerSummary ?? ''),
        ...((li.professionalThemeTags as string[]) ?? []),
        ...((li.skills as string[]) ?? []).slice(0, 15),
      ],
    });
  }
  if (sp || am) {
    bags.push({
      name: 'music',
      texts: [
        ...((sp?.topGenres as string[]) ?? (am?.topGenres as string[]) ?? []),
        ...((sp?.topArtists as string[]) ?? (am?.topArtists as string[]) ?? []).slice(0, 8),
      ],
    });
  }
  if (g) {
    bags.push({
      name: 'google',
      texts: [
        ...((g.topCategories as string[]) ?? []),
        ...((g.lifestyleSignals as string[]) ?? []),
        ...((g.googleSignalTags as string[]) ?? []),
      ],
    });
  }
  if (yt) {
    bags.push({
      name: 'youtube',
      texts: [
        ...((yt.topChannels as string[]) ?? []),
        ...((yt.topCategories as string[]) ?? []),
      ],
    });
  }

  const themes: CrossPlatformTheme[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < bags.length; i++) {
    for (let j = i + 1; j < bags.length; j++) {
      const A = tokenSet(bags[i].texts);
      const B = tokenSet(bags[j].texts);
      const overlap = overlapScore(A, B);
      if (overlap < 2) continue;
      const platforms = [bags[i].name, bags[j].name].sort();
      const key = platforms.join('|') + ':' + overlap;
      if (seen.has(key)) continue;
      seen.add(key);
      const tier: 2 | 3 = overlap >= 4 ? 3 : 2;
      const theme =
        [...A].find(t => B.has(t) && t.length > 4) ??
        [...A].find(t => B.has(t)) ??
        'cross_platform_theme';
      themes.push({
        theme,
        platforms,
        tier,
        label: `${theme} reinforced across ${platforms.join(' + ')}`,
      });
    }
  }

  return themes.slice(0, 12);
}

function deriveNegativeSignals(graph: IdentityGraph, mergedProfile: Record<string, unknown>): NegativeSignalItem[] {
  const out: NegativeSignalItem[] = [];
  const ig = mergedProfile.instagramIdentity as Record<string, unknown> | undefined;

  const eng = graph.engagementTier?.toLowerCase() ?? '';
  if (eng.includes('low') || eng === 'lurker') {
    out.push({
      pattern: 'low_social_engagement',
      implication: 'Consumption-heavy; weak signal for posting or community leadership intent.',
      dampens: ['action', 'growth'],
    });
  }

  if (
    ig &&
    typeof ig.followersCount === 'number' &&
    ig.followersCount > 5000 &&
    typeof ig.mediaCount === 'number' &&
    ig.mediaCount < 12
  ) {
    out.push({
      pattern: 'audience_without_volume',
      implication: 'Large following but sparse catalog — creator identity may be dated or delegated.',
      dampens: ['identity', 'growth'],
    });
  }

  const caption = graph.captionIntent?.toLowerCase() ?? '';
  if (caption.includes('document') && !graph.igPostingCadence?.toLowerCase().includes('daily')) {
    out.push({
      pattern: 'documenting_not_building',
      implication: 'Archive-style posting; lower confidence in aggressive growth or monetization pushes.',
      dampens: ['growth', 'purchase'],
    });
  }

  if (
    graph.topChannels.length >= 6 &&
    graph.igPostingCadence &&
    /monthly|occasional|rare/i.test(graph.igPostingCadence) &&
    (graph.igCreatorTier === 'hobby' || graph.igCreatorTier === 'private')
  ) {
    out.push({
      pattern: 'heavy_consumption_light_output',
      implication: 'Rich viewing/listening graph but light publishing — dampen creator or launch predictions unless contradicted.',
      dampens: ['growth', 'action'],
    });
  }

  // founder_jobseeker_conflict: Instagram bio says founder/ceo but LinkedIn signals job seeking
  const founderPatterns = /\b(founder|co-founder|cofounder|ceo|chief executive)\b/i;
  const bioRolesText = graph.bioRoles.join(' ');
  const li = mergedProfile.linkedinIdentity as Record<string, unknown> | undefined;
  const jobInterests = (li?.jobInterests as string[] | undefined) ?? [];
  if (founderPatterns.test(bioRolesText) && jobInterests.length > 0) {
    out.push({
      pattern: 'founder_jobseeker_conflict',
      implication: 'Instagram bio claims founder/CEO role but LinkedIn signals active job seeking. Treat Instagram bio as ground truth.',
      dampens: ['growth'],
    });
  }

  // creator_consumer_conflict: established IG creator with heavy YouTube consumption likely studying competitors
  const followersCount = typeof ig?.followersCount === 'number' ? ig.followersCount : 0;
  const isCreatorLevel =
    graph.igCreatorTier === 'micro' || followersCount > 5000;
  if (isCreatorLevel && graph.topChannels.length >= 8) {
    out.push({
      pattern: 'creator_consumer_conflict',
      implication: 'Creator-level Instagram presence with heavy YouTube consumption — likely studying competitors, not a passive consumer.',
      dampens: ['consumer_score'],
    });
  }

  return out.slice(0, 8);
}

function computeDeterministicMomentum(
  signalMeter: SignalMeterOutput,
  priorMomentum: number | null,
): { score: number; delta: number } {
  if (priorMomentum === null || priorMomentum === undefined) return { score: 50, delta: 0 };
  const avgStrength = signalMeter.signals.length > 0
    ? signalMeter.signals.reduce((a, s) => a + s.final_score, 0) / signalMeter.signals.length
    : 0;
  const signalCountFactor = Math.min(signalMeter.signals.length / 30, 1.0);
  const newScore = Math.max(0, Math.min(100, Math.round(avgStrength * 60 + signalCountFactor * 40)));
  return { score: newScore, delta: newScore - priorMomentum };
}

function buildMatrixSummary(primary: IntentType): string {
  const row = INTENT_PLATFORM_WEIGHTS[primary];
  const parts = Object.entries(row).map(([k, v]) => `${k}:${v.toFixed(2)}`);
  return `Primary intent mode for this run: "${primary}". Platform multipliers: ${parts.join(', ')}.`;
}

/**
 * Build precalc from identity graph, signal meter, and merged profile.
 */
export function buildBehavioralPrecalc(
  graph: IdentityGraph,
  signalMeter: SignalMeterOutput,
  mergedProfile: Record<string, unknown>,
): BehavioralPrecalcResult {
  const { primary, scores } = classifyIntent(graph, signalMeter, mergedProfile);
  const cross_platform_themes = extractCrossPlatformThemes(graph, mergedProfile);
  const negative_signals = deriveNegativeSignals(graph, mergedProfile);

  const ig = mergedProfile.instagramIdentity;
  const li = mergedProfile.linkedinIdentity;
  const g = mergedProfile.googleIdentity;
  const sp = mergedProfile.spotifyIdentity;
  const am = mergedProfile.appleMusicIdentity;
  const yt = mergedProfile.youtubeIdentity;

  const platform_connected = {
    instagram: Boolean(ig),
    linkedin: Boolean(li),
    google: Boolean(g),
    youtube: Boolean(yt && ((yt as { topChannels?: unknown[] }).topChannels?.length ?? 0) > 0),
    music: Boolean(sp || am),
  };

  const priorMomentum = (mergedProfile.lastMomentumScore as number | undefined) ?? null;
  const { score: momentum_score, delta: momentum_delta } = computeDeterministicMomentum(signalMeter, priorMomentum);

  return {
    primary_intent_type: primary,
    intent_scores: scores,
    cross_platform_themes,
    negative_signals,
    platform_connected,
    intent_weight_matrix_applied: buildMatrixSummary(primary),
    momentum_score,
    momentum_delta,
  };
}

/** Serialize for LLM bundles (compact JSON). */
export function precalcToBundleJson(p: BehavioralPrecalcResult): Record<string, unknown> {
  return {
    intent_classification: {
      primary_intent_type: p.primary_intent_type,
      intent_scores: p.intent_scores,
    },
    cross_platform: p.cross_platform_themes.slice(0, 10).map(t => ({
      theme: t.theme,
      platforms: t.platforms,
      tier: t.tier,
      label: t.label,
    })),
    negative_signals: p.negative_signals,
    platform_connected: p.platform_connected,
    intent_weight_matrix_applied: p.intent_weight_matrix_applied,
  };
}
