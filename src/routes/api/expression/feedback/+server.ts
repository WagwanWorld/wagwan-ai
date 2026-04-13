import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfile, upsertIdentityGraph, isSupabaseConfigured } from '$lib/server/supabase';
import type { ExpressionFeedbackState } from '$lib/types/expressionLayer';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: {
    googleSub?: unknown;
    targetId?: unknown;
    vote?: unknown;
    ref?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!googleSub) return json({ ok: false, error: 'missing_google_sub' }, { status: 400 });
  const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
  if (!targetId) return json({ ok: false, error: 'missing_targetId' }, { status: 400 });
  const vote = body.vote === 'up' || body.vote === 'down' ? body.vote : null;
  if (!vote) return json({ ok: false, error: 'invalid_vote' }, { status: 400 });
  const ref = typeof body.ref === 'string' ? body.ref.trim() : undefined;

  const row = await getProfile(googleSub);
  if (!row) return json({ ok: false, error: 'profile_not_found' }, { status: 404 });

  const graph = (row.identity_graph ?? {}) as Record<string, unknown>;
  const summary = (row.identity_summary as string) ?? '';
  const prior = (graph.expressionFeedback as ExpressionFeedbackState | undefined) ?? {
    votes: [],
    atomNudges: {},
  };
  const priorVotes: ExpressionFeedbackState['votes'] = Array.isArray(prior.votes)
    ? (prior.votes as ExpressionFeedbackState['votes'])
    : [];

  const newVote: ExpressionFeedbackState['votes'][number] = {
    targetId,
    vote,
    at: new Date().toISOString(),
    ...(ref !== undefined ? { ref } : {}),
  };
  const votes = [...priorVotes, newVote].slice(-200);
  const atomNudges = { ...prior.atomNudges };
  if (ref) {
    const delta = vote === 'up' ? 0.12 : -0.12;
    atomNudges[ref] = Math.max(-1, Math.min(1, (atomNudges[ref] ?? 0) + delta));
  }

  const nextGraph = {
    ...graph,
    expressionFeedback: { votes, atomNudges } satisfies ExpressionFeedbackState,
  };

  const ok = await upsertIdentityGraph(googleSub, nextGraph, summary);
  if (!ok) return json({ ok: false, error: 'persist_failed' }, { status: 500 });

  return json({ ok: true });
};
