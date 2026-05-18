import { env } from '$env/dynamic/private';
import { getServiceSupabase } from '$lib/server/supabase';

const BRAND_OS_ALLOWED_ENDPOINTS = new Set([
  '/api/brand/os-dashboard',
  '/api/brand/os-insights',
  '/api/brand/os-brief',
  '/api/brand/os-predict',
  '/api/brand/os-sync',
]);

function killSwitchEnabled(): boolean {
  const raw = String(env.BRAND_OS_AI_KILL_SWITCH || '')
    .toLowerCase()
    .trim();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export async function guardBrandAiEndpoint(endpoint: string): Promise<void> {
  if (killSwitchEnabled()) {
    throw new Error('brand_os_ai_disabled');
  }
  if (!BRAND_OS_ALLOWED_ENDPOINTS.has(endpoint)) {
    throw new Error('brand_os_ai_endpoint_not_allowed');
  }
}

export async function logBrandAiCall(params: {
  brandIgId?: string | null;
  endpoint: string;
  promptVersion: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  metadata?: Record<string, unknown>;
}) {
  const sb = getServiceSupabase();
  await sb.from('brand_ai_call_logs').insert({
    brand_ig_id: params.brandIgId ?? null,
    endpoint: params.endpoint,
    prompt_version: params.promptVersion,
    model: params.model,
    input_tokens: params.inputTokens ?? 0,
    output_tokens: params.outputTokens ?? 0,
    metadata: params.metadata ?? {},
  });
}

export function deprecationErrorPayload(route: string) {
  return {
    ok: false,
    error: 'deprecated_brand_ai_route',
    message: `${route} is deprecated. Use Brand OS routes (/api/brand/os-dashboard, /api/brand/os-insights, /api/brand/os-brief, /api/brand/os-predict).`,
  };
}
