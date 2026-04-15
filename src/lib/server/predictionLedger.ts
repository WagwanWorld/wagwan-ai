/**
 * Track every prediction made by HyperInference.
 * After the predicted timeframe expires, collect outcomes for calibration.
 */
import { getServiceSupabase, isSupabaseConfigured } from './supabase';

interface HyperInferencePrediction {
  action: string;
  probability: number;
  timeframe: string;
}

interface PredictionOutcome {
  predicted_probability: number;
  outcome: boolean | null;
}

export async function insertPredictions(
  googleSub: string,
  predictions: HyperInferencePrediction[],
  inferenceRevision: number,
): Promise<void> {
  if (!isSupabaseConfigured() || predictions.length === 0) return;
  const supabase = getServiceSupabase();
  const rows = predictions.map(pred => {
    const days = parseTimeframeToDays(pred.timeframe);
    return {
      user_google_sub: googleSub,
      inference_revision: inferenceRevision,
      prediction_text: pred.action,
      predicted_probability: pred.probability,
      predicted_timeframe: pred.timeframe,
      predicted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      outcome: null,
    };
  });
  await supabase.from('prediction_outcomes').insert(rows).throwOnError();
}

function parseTimeframeToDays(timeframe: string): number {
  if (/week/i.test(timeframe)) return 14;
  if (/month/i.test(timeframe)) return 45;
  if (/3.+month|quarter/i.test(timeframe)) return 105;
  if (/6.+month/i.test(timeframe)) return 210;
  return 30;
}

export function computeECE(outcomes: PredictionOutcome[]): number {
  const verified = outcomes.filter(o => o.outcome !== null);
  if (verified.length < 5) return 0.5;

  const bins = Array.from({ length: 10 }, (_, i) => ({
    min: i * 0.1, max: (i + 1) * 0.1,
    preds: [] as PredictionOutcome[],
  }));

  for (const o of verified) {
    const bin = bins.find(b => o.predicted_probability >= b.min && o.predicted_probability < b.max);
    if (bin) bin.preds.push(o);
  }

  let ece = 0;
  for (const bin of bins) {
    if (bin.preds.length === 0) continue;
    const avgConf = bin.preds.reduce((a, p) => a + p.predicted_probability, 0) / bin.preds.length;
    const accuracy = bin.preds.filter(p => p.outcome === true).length / bin.preds.length;
    ece += (bin.preds.length / verified.length) * Math.abs(avgConf - accuracy);
  }
  return ece;
}
