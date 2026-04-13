import type { IdentityGraph } from '$lib/server/identity';
import type { InferenceIdentityCurrent } from '$lib/types/inferenceIdentity';
import type { IdentityIntelligencePayload } from '$lib/types/identityIntelligence';
import type { ParsedAudience } from './types';
import type { ProfileRowForMatch } from './audienceMatch';
import { flattenIdentityGraph } from './identityGraphTags';

const BUNDLE_MAX = 15000;

function snip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function compactInference(current: InferenceIdentityCurrent | null): Record<string, unknown> | null {
  if (!current) return null;
  const domains = [...(current.life_domains ?? [])].sort((a, b) => b.salience_0_100 - a.salience_0_100);
  return {
    intent_primary: snip(current.intent.primary, 360),
    predictive_one_liner: current.predictive_read
      ? snip(current.predictive_read.you_in_one_line, 200)
      : null,
    life_domains_top: domains.slice(0, 3).map(d => ({
      id: d.id,
      narrative: snip(d.narrative, 200),
    })),
  };
}

function compactIntelligencePayload(p: IdentityIntelligencePayload | null): Record<string, unknown> | null {
  if (!p) return null;
  return {
    one_line_state: snip(p.snapshot.one_line_state, 220),
    do_this_now: snip(p.decision.do_this_now, 220),
    focus: snip(p.now.focus, 160),
  };
}

export function buildBrandMemberBundle(params: {
  graph: IdentityGraph;
  identitySummary: string;
  inferenceCurrent: InferenceIdentityCurrent | null;
  intelligencePayload: IdentityIntelligencePayload | null;
  recencyContext: string;
  matchReasonFromBrand?: string;
}): string {
  const g = params.graph;
  const bundle = {
    context: 'Brand marketer tactical brief for ONE audience member. Output JSON only when prompted.',
    brand_match_reason_hint: params.matchReasonFromBrand
      ? snip(params.matchReasonFromBrand, 400)
      : null,
    identity_summary: snip(params.identitySummary, 1200),
    graph_compact: {
      topGenres: g.topGenres.slice(0, 10),
      topArtists: g.topArtists.slice(0, 10),
      interests: g.interests.slice(0, 18),
      aesthetic: g.aesthetic,
      brandVibes: g.brandVibes.slice(0, 12),
      headline: snip(g.headline, 200),
      linkedinCareerSnippet: snip(g.linkedinCareerSnippet, 320),
      captionIntent: snip(g.captionIntent, 160),
      igCreatorTier: g.igCreatorTier,
      engagementTier: g.engagementTier,
      manualTags: g.manualTags.slice(0, 12),
    },
    prior_inference_compact: compactInference(params.inferenceCurrent),
    prior_operator_intelligence_compact: compactIntelligencePayload(params.intelligencePayload),
    recency_context: params.recencyContext,
  };
  let json = JSON.stringify(bundle, null, 0);
  if (json.length > BUNDLE_MAX) json = json.slice(0, BUNDLE_MAX) + '…';
  return json;
}

export interface CohortMemberLine {
  user_google_sub: string;
  name: string | null;
  match_score: number;
  match_reason: string;
  preview_tags: string[];
  identity_summary_snip: string;
}

export function buildBrandAudienceCohortBundle(
  structured: ParsedAudience,
  keyTraits: { tag: string; count: number }[],
  members: ProfileRowForMatch[],
  memberExtras: Map<
    string,
    { match_score: number; match_reason: string; preview_tags: string[]; identity_summary: string }
  >,
  maxMembers: number,
): string {
  const sorted = [...members].slice(0, maxMembers);
  const lines: CohortMemberLine[] = sorted.map(row => {
    const ex = memberExtras.get(row.google_sub);
    const graph = row.identity_graph ?? {};
    const summarySnip = ex?.identity_summary
      ? snip(ex.identity_summary, 320)
      : snip(String(graph.headline ?? (graph as { professionalStr?: string }).professionalStr ?? ''), 200);
    const tags =
      ex?.preview_tags?.length ? ex.preview_tags.slice(0, 12) : flattenIdentityGraph(graph).slice(0, 12);
    return {
      user_google_sub: row.google_sub,
      name: row.name,
      match_score: ex?.match_score ?? 0,
      match_reason: snip(ex?.match_reason ?? '', 280),
      preview_tags: tags,
      identity_summary_snip: summarySnip,
    };
  });

  const bundle = {
    context:
      'Brand audience monetization intelligence. Cohort was discovered with this structured query.',
    audience_human_summary: snip(structured.human_summary, 500),
    audience_interests: structured.interests.slice(0, 20),
    audience_behaviors: structured.behaviors.slice(0, 15),
    audience_location: structured.location,
    key_traits: keyTraits.slice(0, 12),
    cohort_members: lines,
  };
  let json = JSON.stringify(bundle, null, 0);
  if (json.length > BUNDLE_MAX) json = json.slice(0, BUNDLE_MAX) + '…';
  return json;
}
