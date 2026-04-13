import type { InferenceLifeDomain } from '$lib/types/inferenceIdentity';
import { parseInferenceIdentityWrapper } from './inferenceIdentitySchema';

/** Pull normalized tokens from identity_graph json (IdentityGraph-like). */

const INFERENCE_FLATTEN_CAP = 200;

/** Tokens derived from validated inferenceIdentity.current (+ light history) for audience overlap. */
export function extractTagsFromInferenceGraph(graph: Record<string, unknown>): string[] {
  const wrap = parseInferenceIdentityWrapper(graph.inferenceIdentity);
  if (!wrap) return [];

  const tags = new Set<string>();
  const add = (s: string) => {
    const t = s.trim().toLowerCase();
    if (t.length > 1) tags.add(t);
  };
  const walk = (v: unknown) => {
    if (tags.size >= INFERENCE_FLATTEN_CAP) return;
    if (typeof v === 'string') {
      for (const part of v.split(/[,;/|]+/)) add(part);
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (v && typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) walk(x);
    }
  };

  walk(wrap.current);
  const last = wrap.history[wrap.history.length - 1];
  if (last?.intentPrimary) add(last.intentPrimary);

  const pr = wrap.current.predictive_read;
  if (pr) {
    walk(pr.you_in_one_line);
    walk(pr.next_moves);
    walk(pr.commerce_affinity);
  }

  const ld = wrap.current.life_domains;
  if (Array.isArray(ld)) {
    for (const d of ld as InferenceLifeDomain[]) {
      if (tags.size >= INFERENCE_FLATTEN_CAP) break;
      if (!d || typeof d !== 'object') continue;
      add(String(d.id ?? '').replace(/_/g, ' '));
      walk(d.label);
      walk(d.narrative);
      walk(d.consumption_vs_creation);
      walk(d.signals);
      walk(d.likely_next);
      for (const e of d.evidence ?? []) {
        if (tags.size >= INFERENCE_FLATTEN_CAP) break;
        walk(e.text);
      }
    }
  }

  return [...tags].slice(0, INFERENCE_FLATTEN_CAP);
}

export function flattenIdentityGraph(graph: Record<string, unknown>): string[] {
  const tags = new Set<string>();
  const add = (s: string) => {
    const t = s.trim().toLowerCase();
    if (t.length > 1) tags.add(t);
  };
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      for (const part of v.split(/[,;/|]+/)) add(part);
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    }
  };

  const walkSceneMap = (v: unknown) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return;
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (typeof n === 'number' && n > 0) add(k.replace(/\s+/g, '_'));
      add(k.replace(/\s+/g, '_'));
    }
  };

  const keys = [
    'interests',
    'topGenres',
    'activities',
    'brandVibes',
    'contentCategories',
    'lifestyleSignals',
    'skills',
    'topHashtags',
    'googleBehaviorHints',
    'googleQueryBoosters',
    'googleSignalTags',
    'googleIntentTokens',
    'bioRoles',
    'topChannels',
    'captionMentions',
    'temporalPeakDays',
    'externalPerception',
    'manualTags',
    'igInsightsTags',
    'skillClusters',
    'industryAffinity',
    'professionalThemeTags',
    'linkedinIntentTokens',
    'musicDescriptorTags',
    'musicLifestyleTags',
    'musicCultureTags',
    'musicMoodTags',
    'listeningBehaviorTags',
    'musicIntentTokens',
    'appleMusicDescriptorTags',
  ];
  for (const k of keys) walk(graph[k]);

  for (const k of [
    'city',
    'lifestyle',
    'aesthetic',
    'musicVibe',
    'foodVibe',
    'travelStyle',
    'captionIntent',
    'musicPersonality',
    'contentPersonality',
    'queryStyleHint',
    'engagementTier',
    'linkedinLocation',
    'temporalPattern',
    'socialVisibility',
    'communityTone',
    'musicSignalNarrative',
    'professionalSignalNarrative',
    'lifeRhythmNarrative',
    'rawSummarySnippet',
    'linkedinCareerSnippet',
    'role',
    'company',
    'industry',
    'headline',
  ]) {
    walk(graph[k]);
  }

  walkSceneMap(graph.visualScenes);

  for (const t of extractTagsFromInferenceGraph(graph)) tags.add(t);

  return [...tags];
}
