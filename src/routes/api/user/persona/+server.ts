import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import {
  getProfile,
  getManualInterestTags,
  insertIdentityInferenceSnapshot,
  isSupabaseConfigured,
  upsertIdentityGraph,
} from '$lib/server/supabase';
import { buildIdentityGraph, identitySummary } from '$lib/server/identity';
import { buildRecencyContext } from '$lib/server/marketplace/buildRecencyContext';
import { parseIdentitySnapshotWrapper } from '$lib/server/marketplace/identitySnapshotSchema';
import { parseIdentityIntelligenceWrapper } from '$lib/server/marketplace/identityIntelligenceSchema';
import {
  mergeNextInference,
  parseInferenceIdentityWrapper,
} from '$lib/server/marketplace/inferenceIdentitySchema';
import { buildInferenceSignalBundle, runInferenceFromBundle } from '$lib/server/marketplace/inferIdentityGraph';
import { parseHyperInferenceWrapper } from '$lib/server/marketplace/hyperInferenceSchema';
import { runIdentitySnapshotFromInputs } from '$lib/server/marketplace/inferIdentitySnapshot';
import { runIdentityIntelligenceFromInputs } from '$lib/server/marketplace/inferIdentityIntelligence';
import { runHyperInferenceFromInputs } from '$lib/server/marketplace/inferHyperInference';
import { buildBehavioralPrecalc } from '$lib/server/behavioralPrecalc';
import { projectMemoryGraph } from '$lib/server/memoryGraphProjection';
import { buildSignalMeter } from '$lib/server/signalMeter';
import { HYPER_INFERENCE_SCHEMA_VERSION_V2 } from '$lib/types/hyperInference';
import { syncIdentityClaimsFromGraph } from '$lib/server/identityClaims/syncFromGraph';
import { runIdentitySynthesisFromInputs } from '$lib/server/marketplace/inferIdentitySynthesis';
import { parseIdentitySynthesisWrapper } from '$lib/server/marketplace/identitySynthesisSchema';
import type { SignalMeterOutput } from '$lib/types/signalMeter';
import { buildExpressionLayer } from '$lib/server/expression/buildExpressionLayer';
import type { IdentityGraph } from '$lib/server/identity';
import type { ExpressionFeedbackState } from '$lib/types/expressionLayer';

/** Trimmed inference wrapper for Home (matches identity-tags shape). */
function buildInferenceForClient(graph: Record<string, unknown>): unknown | null {
  const inferenceFull = parseInferenceIdentityWrapper(graph.inferenceIdentity);
  if (!inferenceFull) return null;
  return {
    ...inferenceFull,
    history: inferenceFull.history.slice(-8),
  };
}

/** Compact inference slice returned to client — avoid sending full history. */
function buildInferenceCompact(raw: unknown): Record<string, unknown> | null {
  const wrap = parseInferenceIdentityWrapper(raw);
  if (!wrap?.current) return null;
  const c = wrap.current;
  const domains = [...(c.life_domains ?? [])].sort(
    (a, b) => b.salience_0_100 - a.salience_0_100,
  );
  return {
    intent_primary: c.intent?.primary ?? '',
    predictive_one_liner: c.predictive_read?.you_in_one_line ?? '',
    life_domains_top: domains.slice(0, 4).map(d => ({
      id: d.id,
      label: d.label,
      salience: d.salience_0_100,
    })),
  };
}

/** Small projection for Home / mobile payloads. */
function buildHyperInferenceCompact(raw: unknown): Record<string, unknown> | null {
  const w = parseHyperInferenceWrapper(raw);
  if (!w) return null;
  if (w.version === HYPER_INFERENCE_SCHEMA_VERSION_V2) {
    const p = w.payload;
    return {
      intent_type: p.intent_type,
      archetype: p.identity.archetype,
      true_intent: p.inference_layer.true_intent,
      predictions: p.prediction_layer.slice(0, 5).map(x => ({
        action: x.action,
        probability: x.probability,
        timeframe: x.timeframe,
      })),
      non_obvious_insights: p.non_obvious_insights.slice(0, 5),
      confidence_by_source: p.confidence.by_source,
      overall_confidence: p.confidence.overall,
    };
  }
  const p = w.payload;
  return {
    taste_mechanism: p.depth_layer.taste_mechanism,
    true_intent: p.inference_layer.true_intent,
    next_7_days: p.prediction_layer.next_7_days.slice(0, 4),
    next_30_days: p.prediction_layer.next_30_days.slice(0, 4),
    non_obvious_insights: p.non_obvious_insights.slice(0, 5),
    high_confidence: p.confidence_matrix.high_confidence.slice(0, 4),
  };
}

function buildSignalHighlights(raw: unknown): Array<{
  type: string;
  category: string;
  value: string;
  final_score: number;
}> {
  const meter = (raw ?? null) as SignalMeterOutput | null;
  const signals = Array.isArray(meter?.signals) ? meter.signals : [];
  return signals.slice(0, 6).map(signal => ({
    type: signal.type,
    category: signal.category,
    value: signal.value,
    final_score: signal.final_score,
  }));
}

/** Top clusters for Home “How I come across” — sorted by intensity. */
function buildSignalClustersPreview(raw: unknown): Array<{
  theme: string;
  intensity: number;
  signals: string[];
}> {
  const meter = (raw ?? null) as SignalMeterOutput | null;
  const clusters = Array.isArray(meter?.clusters) ? meter.clusters : [];
  return [...clusters]
    .sort((a, b) => (b.intensity ?? 0) - (a.intensity ?? 0))
    .slice(0, 3)
    .map(c => ({
      theme: c.theme,
      intensity: c.intensity,
      signals: [...(c.signals ?? [])].slice(0, 5),
    }));
}

function buildSignalDominantPatterns(raw: unknown): string[] {
  const meter = (raw ?? null) as SignalMeterOutput | null;
  const p = meter?.dominant_patterns;
  return Array.isArray(p) ? p.slice(0, 5).map(s => String(s)) : [];
}

/** GET /api/user/persona?sub=... — fast read from DB, no LLM. */
export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub')?.trim() ?? '';
  if (!sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });

  const row = await getProfile(sub);
  if (!row) return json({ ok: false, error: 'profile_not_found' }, { status: 404 });

  const graph = row.identity_graph ?? {};
  const identitySynthesis = parseIdentitySynthesisWrapper(graph.identitySynthesis);
  const identitySnapshot = parseIdentitySnapshotWrapper(graph.identitySnapshot);
  const identityIntelligence = parseIdentityIntelligenceWrapper(graph.identityIntelligence);
  const inferenceCompact = buildInferenceCompact(graph.inferenceIdentity);
  const inference = buildInferenceForClient(graph as Record<string, unknown>);
  const hyperInference = parseHyperInferenceWrapper(graph.hyperInference);
  const hyperInferenceCompact = buildHyperInferenceCompact(graph.hyperInference);
  const memoryGraph = graph.memoryGraph ?? null;
  const signalHighlights = buildSignalHighlights(graph.signalMeter);
  const signalClusters = buildSignalClustersPreview(graph.signalMeter);
  const signalDominantPatterns = buildSignalDominantPatterns(graph.signalMeter);

  return json({
    ok: true,
    identitySynthesis,
    identitySnapshot,
    identityIntelligence,
    inferenceCompact,
    inference,
    hyperInference,
    hyperInferenceCompact,
    memoryGraph,
    signalHighlights,
    signalClusters,
    signalDominantPatterns,
  });
};

/** POST /api/user/persona — force regenerate snapshot + intelligence in parallel, then persist. */
export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: { googleSub?: unknown; force?: unknown; userQuery?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!googleSub) return json({ ok: false, error: 'missing_google_sub' }, { status: 400 });
  const forceRegenerate = body.force === true;
  const userQuery =
    typeof body.userQuery === 'string' && body.userQuery.trim() ? body.userQuery.trim() : undefined;

  const keyOk = Boolean((env.ANTHROPIC_API_KEY ?? '').trim());
  if (!keyOk) return json({ ok: false, error: 'anthropic_not_configured' }, { status: 503 });

  const row = await getProfile(googleSub);
  if (!row) return json({ ok: false, error: 'profile_not_found' }, { status: 404 });

  const profileData = row.profile_data as Record<string, unknown>;
  const manualInterestTags = await getManualInterestTags(googleSub);
  const merged: Record<string, unknown> = {
    ...profileData,
    ...(manualInterestTags.length ? { manualInterestTags } : {}),
  };

  const signalMeter = buildSignalMeter(merged);
  const graph = buildIdentityGraph({ ...merged, signalMeter });
  const behavioralPrecalc = buildBehavioralPrecalc(graph, signalMeter, merged);
  const summaryStr = identitySummary(graph);
  const priorFullGraph = (row.identity_graph ?? {}) as Record<string, unknown>;
  let inferenceWrap = parseInferenceIdentityWrapper(priorFullGraph.inferenceIdentity);

  if (keyOk && forceRegenerate) {
    const bundle = buildInferenceSignalBundle(
      merged,
      graph,
      summaryStr,
      inferenceWrap?.current ?? null,
      {
        meaningfulPlatformSync: false,
        updatedPlatforms: [],
      },
      behavioralPrecalc,
    );
    const current = await runInferenceFromBundle(bundle);
    if (current) {
      const next = mergeNextInference(inferenceWrap, current);
      inferenceWrap = next;
      await insertIdentityInferenceSnapshot(
        googleSub,
        next.revision,
        next as unknown as Record<string, unknown>,
        'persona-regenerate',
      );
    }
  }

  const inferenceCurrent = inferenceWrap?.current ?? null;

  const recency = buildRecencyContext({
    profileData: merged,
    updatedPlatformKeys: [],
  });

  const [snapResult, intelResult, hyperResult] = await Promise.allSettled([
    runIdentitySnapshotFromInputs({
      graph,
      identitySummary: summaryStr,
      inferenceCurrent,
      recencyContext: recency,
    }),
    runIdentityIntelligenceFromInputs({
      graph,
      identitySummary: summaryStr,
      inferenceCurrent,
      recencyContext: recency,
    }),
    runHyperInferenceFromInputs({
      graph,
      signalMeter,
      identitySummary: summaryStr,
      recencyContext: recency,
      mergedProfile: merged,
      behavioralPrecalc,
    }),
  ]);

  const snap = snapResult.status === 'fulfilled' ? snapResult.value : null;
  const intel = intelResult.status === 'fulfilled' ? intelResult.value : null;
  const hyper = hyperResult.status === 'fulfilled' ? hyperResult.value : null;

  if (!snap && !intel && !hyper) {
    return json({ ok: false, error: 'generation_failed' }, { status: 502 });
  }

  const base = graph as unknown as Record<string, unknown>;
  const graphData: Record<string, unknown> = { ...base };
  if (inferenceWrap != null) {
    graphData.inferenceIdentity = inferenceWrap;
  } else if (priorFullGraph.inferenceIdentity != null) {
    graphData.inferenceIdentity = priorFullGraph.inferenceIdentity;
  }
  if (snap) graphData.identitySnapshot = snap;
  else if (priorFullGraph.identitySnapshot != null) graphData.identitySnapshot = priorFullGraph.identitySnapshot;
  if (intel) graphData.identityIntelligence = intel;
  else if (priorFullGraph.identityIntelligence != null) graphData.identityIntelligence = priorFullGraph.identityIntelligence;
  if (hyper) graphData.hyperInference = hyper;
  else if (priorFullGraph.hyperInference != null) graphData.hyperInference = priorFullGraph.hyperInference;

  graphData.memoryGraph = projectMemoryGraph({
    precalc: behavioralPrecalc,
    signalMeter,
    inferenceIdentity: graphData.inferenceIdentity,
    hyperInference: graphData.hyperInference,
  });

  try {
    const synthesis = await runIdentitySynthesisFromInputs({
      graph,
      identitySummary: summaryStr,
      inferenceCurrent,
      recencyContext: recency,
      identitySnapshot: graphData.identitySnapshot ?? null,
      identityIntelligence: graphData.identityIntelligence ?? null,
      hyperInference: graphData.hyperInference ?? null,
      signalMeter: (graphData.signalMeter as SignalMeterOutput | undefined) ?? signalMeter,
      memoryGraph: graphData.memoryGraph ?? null,
      userQuery,
    });
    if (synthesis) {
      graphData.identitySynthesis = synthesis as unknown as Record<string, unknown>;
    } else if (priorFullGraph.identitySynthesis != null) {
      graphData.identitySynthesis = priorFullGraph.identitySynthesis as Record<string, unknown>;
    }
  } catch (e) {
    console.error('[persona POST] identitySynthesis:', e instanceof Error ? e.message : e);
    if (priorFullGraph.identitySynthesis != null) {
      graphData.identitySynthesis = priorFullGraph.identitySynthesis as Record<string, unknown>;
    }
  }

  const priorExprFeedback = priorFullGraph.expressionFeedback as ExpressionFeedbackState | undefined;
  try {
    const graphForExpression: IdentityGraph = {
      ...graph,
      inferenceIdentity: graphData.inferenceIdentity as IdentityGraph['inferenceIdentity'],
      hyperInference: graphData.hyperInference as IdentityGraph['hyperInference'],
    };
    const exprLayer = await buildExpressionLayer({
      mergedProfile: merged,
      graph: graphForExpression,
      identitySummary: summaryStr,
      signalMeter,
      feedback: priorExprFeedback,
    });
    graphData.expressionLayer = exprLayer as unknown as Record<string, unknown>;
  } catch (e) {
    console.error('[persona POST] expressionLayer:', e instanceof Error ? e.message : e);
    if (priorFullGraph.expressionLayer) {
      graphData.expressionLayer = priorFullGraph.expressionLayer as Record<string, unknown>;
    }
  }
  graphData.expressionFeedback = priorExprFeedback ?? { votes: [], atomNudges: {} };

  await upsertIdentityGraph(googleSub, graphData, summaryStr);
  await syncIdentityClaimsFromGraph(googleSub, graph, graphData.inferenceIdentity);

  const inferenceCompact = buildInferenceCompact(graphData.inferenceIdentity);
  const inference = buildInferenceForClient(graphData);
  const hyperInference = parseHyperInferenceWrapper(graphData.hyperInference);
  const hyperInferenceCompact = buildHyperInferenceCompact(graphData.hyperInference);

  const identitySynthesisOut = parseIdentitySynthesisWrapper(graphData.identitySynthesis);

  return json({
    ok: true,
    identitySynthesis: identitySynthesisOut,
    identitySnapshot: snap ?? parseIdentitySnapshotWrapper(priorFullGraph.identitySnapshot),
    identityIntelligence: intel ?? parseIdentityIntelligenceWrapper(priorFullGraph.identityIntelligence),
    inferenceCompact,
    inference,
    hyperInference,
    hyperInferenceCompact,
    memoryGraph: graphData.memoryGraph,
    signalHighlights: buildSignalHighlights(graphData.signalMeter),
    signalClusters: buildSignalClustersPreview(graphData.signalMeter),
    signalDominantPatterns: buildSignalDominantPatterns(graphData.signalMeter),
  });
};

