import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

const MODEL = 'claude-haiku-4-5-20251001';

export interface CreatorIntelligence {
  contentConsistency: number;
  postingFrequency: number;
  growthTrend: 'up' | 'stable' | 'declining';
  brandReadinessScore: number;
  subScores: {
    signalCompleteness: number;
    audienceQuality: number;
    contentConsistency: number;
    categoryFit: number;
  };
  improvementHints: string[];
  computedAt: string;
}

function computeSignalCompleteness(
  graph: Record<string, unknown>,
  ig: Record<string, unknown> | undefined,
): number {
  const fields = [
    graph.aesthetic,
    graph.lifestyle,
    graph.brandVibes,
    graph.contentCategories,
    graph.interests,
    graph.city,
    graph.activities,
    ig?.engagement,
    ig?.captionIntent,
    ig?.personality,
    ig?.visual,
    ig?.username,
  ];
  const filled = fields.filter((f) => {
    if (f == null) return false;
    if (typeof f === 'string') return f.trim().length > 0;
    if (Array.isArray(f)) return f.length > 0;
    if (typeof f === 'object') return Object.keys(f as object).length > 0;
    return true;
  }).length;
  return Math.round((filled / fields.length) * 100);
}

function computeAudienceQuality(ig: Record<string, unknown> | undefined): number {
  const engagement = ig?.engagement as Record<string, unknown> | undefined;
  const rate = (engagement?.engagementRate as number) ?? (ig?.engagementRate as number) ?? 0;
  const followers = (ig?.followersCount as number) ?? 0;

  let baseScore: number;
  if (rate >= 0.05) baseScore = 100;
  else if (rate >= 0.03) baseScore = 80;
  else if (rate >= 0.01) baseScore = 60;
  else if (rate >= 0.005) baseScore = 40;
  else baseScore = 20;

  // Bonus for decent engagement at higher follower counts
  if (followers > 10000 && rate >= 0.02) baseScore = Math.min(100, baseScore + 10);
  if (followers > 50000 && rate >= 0.015) baseScore = Math.min(100, baseScore + 10);

  return baseScore;
}

function computeContentConsistency(
  graph: Record<string, unknown>,
  ig: Record<string, unknown> | undefined,
): number {
  let score = 0;

  // Clear aesthetic = +30
  const aesthetic = (graph.aesthetic as string) || (ig?.aesthetic as string) || '';
  if (aesthetic.trim().length > 0) score += 30;

  // Focused content categories (2-4 is ideal) = +30
  const categories = (graph.contentCategories as string[]) ?? [];
  if (categories.length >= 2 && categories.length <= 4) score += 30;
  else if (categories.length === 1 || categories.length === 5) score += 20;
  else if (categories.length > 5) score += 10;

  // Caption intent present = +20
  const captionIntent = (ig?.captionIntent as string) ?? '';
  if (captionIntent.trim().length > 0) score += 20;

  // Personality scores exist = +20
  const personality = ig?.personality as Record<string, number> | undefined;
  if (personality && Object.keys(personality).length > 0) score += 20;

  return Math.min(100, score);
}

function computeCategoryFit(graph: Record<string, unknown>): number {
  // Categories that brands commonly run campaigns in
  const brandCategories = [
    'fashion',
    'beauty',
    'food',
    'fitness',
    'travel',
    'tech',
    'finance',
    'lifestyle',
    'music',
    'entertainment',
    'health',
    'wellness',
    'gaming',
    'education',
    'sports',
    'automotive',
    'home',
    'parenting',
    'pets',
  ];
  const creatorCategories = ((graph.contentCategories as string[]) ?? []).map((c) =>
    c.toLowerCase(),
  );
  const brandVibes = ((graph.brandVibes as string[]) ?? []).map((v) => v.toLowerCase());

  const allCreatorSignals = [...creatorCategories, ...brandVibes];
  const matches = brandCategories.filter((bc) =>
    allCreatorSignals.some((cs) => cs.includes(bc) || bc.includes(cs)),
  ).length;

  return Math.min(100, Math.round((matches / 4) * 100)); // 4+ matches = 100
}

function computePostingFrequency(ig: Record<string, unknown> | undefined): number {
  const mediaCount = (ig?.mediaCount as number) ?? 0;
  // Rough estimate: assume account age ~2 years if no better data
  if (mediaCount <= 0) return 0;
  const weeksEstimate = 104; // 2 years
  return Math.round((mediaCount / weeksEstimate) * 10) / 10;
}

function computeGrowthTrend(
  ig: Record<string, unknown> | undefined,
): 'up' | 'stable' | 'declining' {
  const followers = (ig?.followersCount as number) ?? 0;
  const engagement = ig?.engagement as Record<string, unknown> | undefined;
  const rate = (engagement?.engagementRate as number) ?? 0;
  const tier = (ig?.igCreatorTier as string) ?? '';

  // Heuristic: good engagement + decent followers = growing
  if (rate >= 0.03 && followers > 500) return 'up';
  if (rate >= 0.01) return 'stable';
  return 'declining';
}

async function generateHints(
  subScores: CreatorIntelligence['subScores'],
  categories: string[],
  engagementRate: number,
): Promise<string[]> {
  const key = env.ANTHROPIC_API_KEY ?? '';
  if (!key)
    return [
      'Connect more platforms to strengthen your signal',
      'Post consistently to improve brand readiness',
    ];

  try {
    const anthropic = new Anthropic({ apiKey: key, timeout: 30_000 });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Creator analytics scores:
- Signal completeness: ${subScores.signalCompleteness}/100
- Audience quality: ${subScores.audienceQuality}/100
- Content consistency: ${subScores.contentConsistency}/100
- Category fit: ${subScores.categoryFit}/100
- Content categories: ${categories.slice(0, 5).join(', ') || 'none detected'}
- Engagement rate: ${(engagementRate * 100).toFixed(1)}%

Generate exactly 3 short, specific, actionable tips (under 15 words each) to improve their brand matchability. Return ONLY the 3 tips, one per line, no numbering or bullets.`,
        },
      ],
    });

    const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    const hints = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && l.length < 100)
      .slice(0, 3);

    return hints.length > 0
      ? hints
      : [
          'Post consistently to build audience trust',
          'Diversify content to match more brand categories',
        ];
  } catch {
    return [
      'Post consistently to build audience trust',
      'Diversify content to match more brand categories',
    ];
  }
}

export async function computeCreatorIntelligence(
  identityGraph: Record<string, unknown>,
  profileData: Record<string, unknown>,
): Promise<CreatorIntelligence> {
  const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;
  const engagement = ig?.engagement as Record<string, unknown> | undefined;
  const engagementRate = (engagement?.engagementRate as number) ?? 0;

  const signalCompleteness = computeSignalCompleteness(identityGraph, ig);
  const audienceQuality = computeAudienceQuality(ig);
  const contentConsistency = computeContentConsistency(identityGraph, ig);
  const categoryFit = computeCategoryFit(identityGraph);

  const subScores = { signalCompleteness, audienceQuality, contentConsistency, categoryFit };

  const brandReadinessScore = Math.round(
    signalCompleteness * 0.2 +
      audienceQuality * 0.3 +
      contentConsistency * 0.25 +
      categoryFit * 0.25,
  );

  const categories = (identityGraph.contentCategories as string[]) ?? [];
  const improvementHints = await generateHints(subScores, categories, engagementRate);

  return {
    contentConsistency,
    postingFrequency: computePostingFrequency(ig),
    growthTrend: computeGrowthTrend(ig),
    brandReadinessScore,
    subScores,
    improvementHints,
    computedAt: new Date().toISOString(),
  };
}
