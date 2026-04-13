/**
 * Expression Engine — downstream module payloads (shopping, moodboard, vibe, suggestions).
 */
import type { IdentityGraph } from '$lib/server/identity';
import type {
  ContradictionPayload,
  CurrentVibePayload,
  ExpressionLayer,
  MicroSuggestionPayload,
  MoodboardPayload,
} from '$lib/types/expressionLayer';
import { tierFromConfidence } from '$lib/types/expressionLayer';
import type { BehavioralPrecalcResult } from '$lib/server/behavioralPrecalc';
import { seededUnit, expressionSeed } from './seed';

export { expressionSeed, seededUnit };

export function variabilityScore(base: number, seed: string, salt: string): number {
  const r = seededUnit(seed, salt);
  return Math.max(0, Math.min(1, base * 0.7 + r * 0.3));
}

export interface ShopRankedIdea {
  product: string;
  query: string;
  why: string;
  emoji: string;
  confidence: number;
  tier: ReturnType<typeof tierFromConfidence>;
  vibeName?: string;
}

/** Rank raw product ideas using vibe strength × relevance proxy × novelty from seed. */
export function rankShopIdeas(
  ideas: Array<{ product: string; query: string; why: string; emoji: string }>,
  layer: ExpressionLayer,
  seed: string,
): ShopRankedIdea[] {
  const topVibe = layer.vibes[0];
  const secondVibe = layer.vibes[1];
  return ideas.map((idea, i) => {
    const text = `${idea.product} ${idea.why}`.toLowerCase();
    let relevance = 0.55;
    for (const v of layer.vibes) {
      for (const atom of v.atoms) {
        if (atom.length > 2 && text.includes(atom.toLowerCase())) relevance += 0.08;
      }
    }
    relevance = Math.min(1, relevance);
    const vibeStrength = topVibe?.strength ?? 0.7;
    const novelty = seededUnit(seed, `idea:${i}:${idea.product.slice(0, 40)}`);
    const raw = vibeStrength * relevance * (0.75 + novelty * 0.25);
    const score = variabilityScore(raw, seed, `shop:${i}`);
    const tier = tierFromConfidence(score);
    return {
      ...idea,
      confidence: score,
      tier,
      vibeName: topVibe?.name,
    };
  });
}

export function buildMoodboardPayload(graph: IdentityGraph, layer: ExpressionLayer): MoodboardPayload {
  const names = layer.vibes.slice(0, 3).map(v => v.name);
  const atomSample = layer.atoms.slice(0, 8).map(a => a.label);
  const baseQ = [...names, ...atomSample].join(' ').slice(0, 200);

  const imageQueries = [
    `${baseQ} editorial photography natural light`.trim(),
    `${graph.aesthetic || 'modern'} interior texture minimal`.trim(),
    `${graph.styleQueryStr || graph.musicVibe || ''} mood still life`.trim(),
  ].filter(q => q.length > 8);

  const colors =
    graph.visualColorPalette?.length ? graph.visualColorPalette.slice(0, 5) : fallbackHexFromAesthetic(graph.aesthetic);

  const textures: string[] = [];
  const low = `${graph.aesthetic} ${graph.lifestyle} ${atomSample.join(' ')}`.toLowerCase();
  if (/linen|natural|cotton/.test(low)) textures.push('linen');
  if (/glass|chrome|metal/.test(low)) textures.push('glass');
  if (/concrete|stone|cement/.test(low)) textures.push('concrete');
  if (/leather|suede/.test(low)) textures.push('leather');
  if (!textures.length) textures.push('matte paper', 'soft fabric');

  return { imageQueries, colors, textures };
}

function fallbackHexFromAesthetic(aesthetic: string): string[] {
  const a = aesthetic.toLowerCase();
  if (/warm|earth|terracotta/.test(a)) return ['#F5F0E8', '#8B6914', '#C4A77D'];
  if (/cool|blue|navy/.test(a)) return ['#E8EEF5', '#1A2F4A', '#7D9CC4'];
  return ['#F5F5F0', '#1A1A1A', '#C2A98F'];
}

export function buildCurrentVibe(
  graph: IdentityGraph,
  layer: ExpressionLayer,
): CurrentVibePayload {
  const h = new Date().getHours();
  let timeCue = 'daytime rhythm';
  if (h >= 5 && h < 11) timeCue = 'early focus';
  else if (h >= 11 && h < 17) timeCue = 'midday momentum';
  else if (h >= 17 && h < 22) timeCue = 'evening unwind';
  else timeCue = 'late-night introspection';

  const twin = graph.googleBehaviorHints?.[0];
  const music = graph.musicVibe?.slice(0, 80) ?? '';
  const primary = layer.vibes[0]?.name ?? graph.aesthetic ?? 'steady self';

  const label = [timeCue, primary, twin ? twin.slice(0, 40) : '', music ? music.slice(0, 40) : '']
    .filter(Boolean)
    .join(' · ')
    .slice(0, 96);

  const conf = layer.vibes[0]?.strength ?? 0.65;
  return { label: label || 'present and selective', confidence: conf };
}

export function buildMicroSuggestions(
  layer: ExpressionLayer,
  precalc: BehavioralPrecalcResult | null | undefined,
): MicroSuggestionPayload[] {
  const primary = layer.vibes[0]?.name ?? 'your lane';
  const gap = precalc?.primary_intent_type
    ? String(precalc.primary_intent_type).replace(/_/g, ' ')
    : 'one small next step';

  const templates = [
    `Refine, don't add — stay ${primary.slice(0, 24)}`,
    `Ship something tiny toward ${gap.slice(0, 32)}`,
    `Post one raw thought tonight`,
    `Host something small, not big`,
    `Protect a quiet hour today`,
  ];

  return templates.slice(0, 4).map((text, i) => ({
    text: text.slice(0, 80),
    confidence: Math.max(0.4, 0.85 - i * 0.08),
  }));
}

export function buildContradiction(layer: ExpressionLayer): ContradictionPayload | null {
  const sorted = [...layer.atoms].sort((a, b) => b.strength - a.strength);
  let a = sorted[0];
  let b = sorted.find(x => x.category !== a?.category && x.label !== a?.label);
  if (!a || !b) {
    if (sorted.length < 2) return null;
    a = sorted[0]!;
    b = sorted[1]!;
  }
  const line = `You love ${a.label}\nbut ${b.label} keeps showing up`;
  const confidence = Math.min(a.strength, b.strength) * 0.95;
  return { line, confidence };
}
