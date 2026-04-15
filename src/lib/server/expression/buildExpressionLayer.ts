import { env } from '$env/dynamic/private';
import { buildIdentityGraph } from '$lib/server/identity';
import type { IdentityGraph } from '$lib/server/identity';
import type { ExpressionFeedbackState, ExpressionLayer } from '$lib/types/expressionLayer';
import { EXPRESSION_LAYER_VERSION } from '$lib/types/expressionLayer';
import type { SignalMeterOutput } from '$lib/types/signalMeter';
import { buildSignalMeter } from '$lib/server/signalMeter';
import { collectUnifiedSignals } from './unifiedSignals';
import { selectTopUnifiedSignals } from './signalStrength';
import { fallbackAtomsAndVibesFromSignals, runAtomsAndVibesLlm } from './atomsVibesLlm';

export interface BuildExpressionLayerInput {
  mergedProfile: Record<string, unknown>;
  graph: IdentityGraph;
  identitySummary: string;
  signalMeter: SignalMeterOutput;
  feedback?: ExpressionFeedbackState | null;
}

export async function buildExpressionLayer(
  input: BuildExpressionLayerInput,
): Promise<ExpressionLayer> {
  const atomNudges = input.feedback?.atomNudges;

  const unified = collectUnifiedSignals({
    mergedProfile: input.mergedProfile,
    graph: input.graph,
    signalMeter: input.signalMeter,
    atomNudges,
  });
  const topSignals = selectTopUnifiedSignals(unified);

  const llm = await runAtomsAndVibesLlm(topSignals, input.identitySummary);

  let atoms = llm?.atoms ?? [];
  let vibes = llm?.vibes ?? [];

  if (atoms.length < 6) {
    const fb = fallbackAtomsAndVibesFromSignals(topSignals);
    atoms = fb.atoms.length ? fb.atoms : atoms;
    if (!vibes.length) vibes = fb.vibes;
  }

  if (vibes.length < 2) {
    const fb = fallbackAtomsAndVibesFromSignals(
      topSignals.length ? topSignals : unified.slice(0, 40),
    );
    vibes = fb.vibes;
    if (atoms.length < 4) atoms = fb.atoms;
  }

  // Apply user votes to atom strength — ground truth calibration
  const votes = input.feedback?.votes ?? [];
  if (votes.length > 0) {
    for (const atom of atoms) {
      const vote = votes.find(v =>
        v.targetId?.toLowerCase() === (atom.label ?? '').toLowerCase()
      );
      if (vote) {
        const oldStrength = atom.strength ?? 0.5;
        atom.strength = Math.max(0, Math.min(1, oldStrength * (vote.vote === 'up' ? 1.25 : 0.40)));
      }
    }
  }

  return {
    version: EXPRESSION_LAYER_VERSION,
    generatedAt: new Date().toISOString(),
    unifiedSignals: topSignals,
    atoms: atoms.slice(0, 40),
    vibes: vibes.slice(0, 5),
  };
}

export function parseExpressionLayer(raw: unknown): ExpressionLayer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== EXPRESSION_LAYER_VERSION) return null;
  if (typeof o.generatedAt !== 'string') return null;
  if (!Array.isArray(o.unifiedSignals) || !Array.isArray(o.atoms) || !Array.isArray(o.vibes)) {
    return null;
  }
  return o as unknown as ExpressionLayer;
}

/** When graph has no persisted layer yet (e.g. first shop hit), build once. */
export async function getOrBuildExpressionLayer(
  g: IdentityGraph,
  profile: Record<string, unknown>,
  identitySummary: string,
): Promise<ExpressionLayer | null> {
  if (g.expressionLayer?.atoms?.length && g.expressionLayer.vibes?.length) {
    return g.expressionLayer;
  }
  const keyOk = Boolean((env.ANTHROPIC_API_KEY ?? '').trim());
  if (!keyOk) return g.expressionLayer ?? null;

  try {
    const signalMeter = buildSignalMeter(profile as Parameters<typeof buildSignalMeter>[0]);
    const baseGraph = buildIdentityGraph({ ...profile, signalMeter });
    const graphMerged: IdentityGraph = {
      ...baseGraph,
      inferenceIdentity: g.inferenceIdentity,
      hyperInference: g.hyperInference,
      expressionFeedback: g.expressionFeedback,
    };
    return await buildExpressionLayer({
      mergedProfile: profile,
      graph: graphMerged,
      identitySummary,
      signalMeter,
      feedback: g.expressionFeedback,
    });
  } catch (e) {
    console.error('[getOrBuildExpressionLayer]', e instanceof Error ? e.message : e);
    return g.expressionLayer ?? null;
  }
}
