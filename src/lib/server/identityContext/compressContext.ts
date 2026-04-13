import type {
  CompressedContext,
  CompressedPersona,
  CompressedState,
  CompressionInput,
  RankedSignalLine,
} from '$lib/types/contextPack';

function pickPredictions(input: CompressionInput): string[] {
  const pred = input.slices.prediction_layer as
    | {
        hyper_predictions?: { next_7_days?: string[]; next_30_days?: string[] };
        likely_next_actions?: string[];
        inference_predictions?: { short_term?: string[]; long_term?: string[] };
      }
    | undefined;

  const fromHyper = [
    ...(pred?.hyper_predictions?.next_7_days ?? []),
    ...(pred?.hyper_predictions?.next_30_days ?? []).slice(0, 3),
  ];
  const fromInf = [
    ...(pred?.likely_next_actions ?? []),
    ...(pred?.inference_predictions?.short_term ?? []).slice(0, 4),
  ];
  const merged = [...fromHyper, ...fromInf]
    .map(s => String(s).trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of merged) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= 10) break;
  }
  return out;
}

function pickPersona(slices: Record<string, unknown>): CompressedPersona | undefined {
  const p = slices.persona as
    | { one_liner?: string; archetype?: string; identity_tags?: string[] }
    | undefined;
  if (!p) return undefined;
  const out: CompressedPersona = {};
  const hero = p.one_liner?.trim();
  const archetype = p.archetype?.trim();
  const tags = Array.isArray(p.identity_tags) ? p.identity_tags.slice(0, 6) : undefined;
  if (hero) out.hero = hero;
  if (archetype) out.archetype = archetype;
  if (tags?.length) out.tags = tags;
  return Object.keys(out).length ? out : undefined;
}

function pickState(slices: Record<string, unknown>): CompressedState | undefined {
  const cs = slices.current_state as
    | {
        intelligence_snapshot?: { mode?: string; one_line_state?: string };
        intelligence_now?: { focus?: string; pressure?: string; momentum?: string };
      }
    | undefined;
  if (!cs) return undefined;
  const mode = cs.intelligence_snapshot?.mode;
  const one_line = cs.intelligence_snapshot?.one_line_state;
  const focus = cs.intelligence_now?.focus;
  const pressure = cs.intelligence_now?.pressure;
  const momentum = cs.intelligence_now?.momentum;
  if (!mode && !one_line && !focus) return undefined;
  return {
    mode,
    one_line,
    focus,
    pressure,
    momentum,
    risk: pressure,
    edge: momentum,
  };
}

function pickKeyFocus(slices: Record<string, unknown>): string | null {
  const dl = slices.decision_layer as { decision?: { do_this_now?: string } } | undefined;
  const d = dl?.decision?.do_this_now?.trim();
  if (d) return d;
  const cs = slices.current_state as { hyper_true_intent?: string } | undefined;
  const t = cs?.hyper_true_intent?.trim();
  return t || null;
}

export function compressContext(input: CompressionInput): CompressedContext {
  const signals: RankedSignalLine[] = input.ranked_signals.slice(0, 10).map(s => ({
    type: s.type,
    value: s.value.slice(0, 240),
    score: Math.round(s.score * 1000) / 1000,
  }));

  const predictions = pickPredictions(input);
  const persona = pickPersona(input.slices);
  const state = pickState(input.slices);
  const key_focus = pickKeyFocus(input.slices);

  const out: CompressedContext = {
    query: input.query,
    intent: input.intent,
    timestamp: input.timestamp,
    slices_used: input.sliceIds,
    signals: signals.length ? signals : undefined,
    predictions: predictions.length ? predictions : undefined,
    persona: persona && Object.keys(persona).length ? persona : undefined,
    state: state && Object.keys(state).length ? state : undefined,
    key_focus: key_focus ?? undefined,
  };

  const claims = input.claims_relevant
    .map(c => c.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12);
  if (claims.length) out.claims_relevant = claims;

  return stripEmptyCompressed(out);
}

function stripEmptyCompressed(obj: CompressedContext): CompressedContext {
  const o = { ...obj } as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v === undefined || v === null) delete o[k];
    else if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
      const inner = v as Record<string, unknown>;
      if (Object.keys(inner).length === 0) delete o[k];
    } else if (Array.isArray(v) && v.length === 0) delete o[k];
  }
  stripEmptyNested(o.persona);
  stripEmptyNested(o.state);
  return o as unknown as CompressedContext;
}

function stripEmptyNested(obj: unknown): void {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  const r = obj as Record<string, unknown>;
  for (const k of Object.keys(r)) {
    if (r[k] === undefined || r[k] === null || r[k] === '') delete r[k];
  }
}
