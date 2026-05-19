import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { predictPerformance } from '$lib/server/brand/brandOsEngine';
import { getServiceSupabase } from '$lib/server/supabase';
import { guardBrandAiEndpoint, logBrandAiCall } from '$lib/server/brand/llmGovernance';
import { BRAND_OS_PROMPT_VERSIONS } from '$lib/server/prompts/brand-os';

const ENDPOINT = '/api/brand/os-predict';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');
  await guardBrandAiEndpoint(ENDPOINT);
  const sb = getServiceSupabase();
  const { data } = await sb
    .from('performance_predictions')
    .select(
      'prediction_input,predicted_engagement,confidence,risk_factors,analog_post_ids,created_at',
    )
    .eq('brand_ig_id', igUserId)
    .order('created_at', { ascending: false })
    .limit(30);
  await logBrandAiCall({
    brandIgId: igUserId,
    endpoint: ENDPOINT,
    promptVersion: BRAND_OS_PROMPT_VERSIONS.predict,
    model: 'nearest-analog-v1',
    metadata: { mode: 'read', rows: data?.length ?? 0 },
  });
  return json({ ok: true, predictions: data ?? [] });
};

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');
  await guardBrandAiEndpoint(ENDPOINT);
  const body = await request.json().catch(() => ({}));
  const prediction = await predictPerformance(igUserId, {
    hook_archetype: typeof body.hook_archetype === 'string' ? body.hook_archetype : undefined,
    cta_type: typeof body.cta_type === 'string' ? body.cta_type : undefined,
    caption_length: Number.isFinite(Number(body.caption_length))
      ? Number(body.caption_length)
      : undefined,
    media_type: typeof body.media_type === 'string' ? body.media_type : undefined,
  });
  await logBrandAiCall({
    brandIgId: igUserId,
    endpoint: ENDPOINT,
    promptVersion: BRAND_OS_PROMPT_VERSIONS.predict,
    model: 'nearest-analog-v1',
    metadata: { mode: 'generate', confidence: prediction.confidence },
  });
  return json({ ok: true, prediction });
};
