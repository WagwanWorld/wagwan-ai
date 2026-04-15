/**
 * Central feedback processor. Receives events from: recommendation clicks/dismisses,
 * expression atom votes, chat signals. Outputs signal adjustment multipliers
 * applied in the next signal meter run.
 */
import { getServiceSupabase, isSupabaseConfigured, getProfile } from './supabase';

export interface FeedbackAdjustment {
  target_value: string;
  target_category: string;
  multiplier: number;
  source: 'atom_vote' | 'rec_click' | 'rec_dismiss' | 'chat_signal' | 'outcome';
  confidence: number;
}

export async function buildFeedbackAdjustments(googleSub: string): Promise<FeedbackAdjustment[]> {
  const adjustments: FeedbackAdjustment[] = [];

  // 1. Expression atom votes (highest confidence — explicit user judgment)
  try {
    const profile = await getProfile(googleSub);
    const graphData = profile?.identity_graph as Record<string, unknown> | undefined;
    const feedbackState = graphData?.expressionFeedback as { votes?: Array<{ targetId: string; vote: 'up' | 'down'; category?: string }> } | undefined;
    const votes = feedbackState?.votes ?? [];
    for (const vote of votes) {
      adjustments.push({
        target_value: vote.targetId,
        target_category: vote.category ?? 'any',
        multiplier: vote.vote === 'up' ? 1.30 : 0.35,
        source: 'atom_vote',
        confidence: 1.0,
      });
    }
  } catch { /* profile read failure — skip votes */ }

  // 2. Recommendation feedback (revealed preference)
  if (isSupabaseConfigured()) {
    try {
      const supabase = getServiceSupabase();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('recommendation_feedback').select('entity_category, action')
        .eq('user_google_sub', googleSub)
        .gte('created_at', weekAgo);

      const categoryScores: Record<string, number> = {};
      for (const fb of data ?? []) {
        const cat = fb.entity_category ?? 'unknown';
        categoryScores[cat] = (categoryScores[cat] ?? 0) +
          (fb.action === 'save' ? 2 : fb.action === 'click' ? 1 : fb.action === 'share' ? 3 : fb.action === 'dismiss' ? -2 : 0);
      }
      for (const [cat, score] of Object.entries(categoryScores)) {
        if (Math.abs(score) >= 2) {
          adjustments.push({
            target_value: cat, target_category: 'recommendation_affinity',
            multiplier: score > 0 ? Math.min(1 + score * 0.08, 1.5) : Math.max(1 + score * 0.08, 0.3),
            source: score > 0 ? 'rec_click' : 'rec_dismiss',
            confidence: Math.min(Math.abs(score) / 10 + 0.6, 0.95),
          });
        }
      }
    } catch { /* DB failure — skip rec feedback */ }
  }

  return adjustments;
}
