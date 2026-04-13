/**
 * Moodboard + expression module bundle (palette, queries, current vibe, suggestions, contradiction).
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import { getOrBuildExpressionLayer } from '$lib/server/expression/buildExpressionLayer';
import {
  buildMoodboardPayload,
  buildCurrentVibe,
  buildMicroSuggestions,
  buildContradiction,
} from '$lib/server/expression/modules';
import { buildBehavioralPrecalc } from '$lib/server/behavioralPrecalc';
import { buildSignalMeter } from '$lib/server/signalMeter';

export const POST: RequestHandler = async ({ request }) => {
  let body: { googleSub?: unknown; profile?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const profile = (body.profile ?? {}) as Record<string, unknown>;
  const { graph: g, summary } = await resolveIdentityGraph(
    typeof body.googleSub === 'string' ? body.googleSub : undefined,
    profile,
  );

  const layer = await getOrBuildExpressionLayer(g, profile, summary);
  if (!layer) {
    return json({
      moodboard: { imageQueries: [], colors: [], textures: [] },
      currentVibe: { label: 'steady rhythm', confidence: 0.5 },
      microSuggestions: [],
      contradiction: null,
    });
  }

  const signalMeter = buildSignalMeter(profile as Parameters<typeof buildSignalMeter>[0]);
  const precalc = buildBehavioralPrecalc(g, signalMeter, profile);

  return json({
    moodboard: buildMoodboardPayload(g, layer),
    currentVibe: buildCurrentVibe(g, layer),
    microSuggestions: buildMicroSuggestions(layer, precalc),
    contradiction: buildContradiction(layer),
    expressionLayer: {
      generatedAt: layer.generatedAt,
      vibes: layer.vibes.map(v => ({ name: v.name, strength: v.strength, atoms: v.atoms })),
      atomCount: layer.atoms.length,
    },
  });
};
