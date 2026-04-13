import type { CompressedContext } from '$lib/types/contextPack';

/** Human-readable block for system/user messages (token-aware vs raw JSON). */
export function formatCompressedContextForPrompt(ctx: CompressedContext | null): string {
  if (!ctx) return '';
  const json = JSON.stringify(ctx);
  if (json.length > 6_000) {
    const small: CompressedContext = {
      query: ctx.query,
      intent: ctx.intent,
      timestamp: ctx.timestamp,
      persona: ctx.persona,
      state: ctx.state,
      signals: ctx.signals?.slice(0, 6),
      predictions: ctx.predictions?.slice(0, 6),
      key_focus: ctx.key_focus,
      claims_relevant: ctx.claims_relevant?.slice(0, 8),
      slices_used: ctx.slices_used,
    };
    return `Identity context pack (query-shaped, compressed):\n${JSON.stringify(small)}`;
  }
  return `Identity context pack (query-shaped, compressed):\n${json}`;
}

/** Appended to system when using a context pack (decision-assistant mode). */
export const CONTEXT_PACK_SYSTEM_ADDENDUM = `You may receive an "Identity context pack" JSON: structured persona, state, ranked signals, and predictions derived from the user's real signals. Treat it as grounded truth. When the pack contains specifics, do not generalize or give generic advice. Use persona, state, signals, and predictions to be sharp and specific; where appropriate, offer one clear action, one insight, and one caveat or warning. Match the twin voice from your main instructions.`;
