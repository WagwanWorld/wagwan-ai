import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { generateDailyBrief } from '$lib/server/brand/brandOsEngine';
import { getServiceSupabase } from '$lib/server/supabase';
import { guardBrandAiEndpoint, logBrandAiCall } from '$lib/server/brand/llmGovernance';
import { BRAND_OS_PROMPT_VERSIONS } from '$lib/server/prompts/brand-os';

const ENDPOINT = '/api/brand/os-brief';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');
  await guardBrandAiEndpoint(ENDPOINT);
  const sb = getServiceSupabase();
  const { data } = await sb
    .from('daily_briefs')
    .select('brief_date,headline,synopsis,actions,evidence,created_at')
    .eq('brand_ig_id', igUserId)
    .order('brief_date', { ascending: false })
    .limit(30);
  await logBrandAiCall({
    brandIgId: igUserId,
    endpoint: ENDPOINT,
    promptVersion: BRAND_OS_PROMPT_VERSIONS.brief,
    model: 'deterministic-brief',
    metadata: { mode: 'read', rows: data?.length ?? 0 },
  });
  return json({ ok: true, briefs: data ?? [] });
};

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');
  await guardBrandAiEndpoint(ENDPOINT);
  const brief = await generateDailyBrief(igUserId);
  await logBrandAiCall({
    brandIgId: igUserId,
    endpoint: ENDPOINT,
    promptVersion: BRAND_OS_PROMPT_VERSIONS.brief,
    model: 'deterministic-brief',
    metadata: { mode: 'generate', actions: brief.actions.length },
  });
  return json({ ok: true, brief });
};
