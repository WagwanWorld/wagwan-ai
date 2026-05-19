import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { computePillars, runInsightDetectors } from '$lib/server/brand/brandOsEngine';
import { guardBrandAiEndpoint, logBrandAiCall } from '$lib/server/brand/llmGovernance';
import { BRAND_OS_PROMPT_VERSIONS } from '$lib/server/prompts/brand-os';

const ENDPOINT = '/api/brand/os-insights';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');
  await guardBrandAiEndpoint(ENDPOINT);
  const sb = getServiceSupabase();
  const { data } = await sb
    .from('insight_findings')
    .select(
      'finding_type,severity,title,summary,suggested_action,evidence_post_ids,evidence_metrics,created_at',
    )
    .eq('brand_ig_id', igUserId)
    .order('created_at', { ascending: false })
    .limit(40);
  await logBrandAiCall({
    brandIgId: igUserId,
    endpoint: ENDPOINT,
    promptVersion: BRAND_OS_PROMPT_VERSIONS.insights,
    model: 'deterministic-rules',
    metadata: { mode: 'read', rows: data?.length ?? 0 },
  });
  return json({ ok: true, findings: data ?? [] });
};

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');
  await guardBrandAiEndpoint(ENDPOINT);

  const [pillars, findings] = await Promise.all([
    computePillars(igUserId),
    runInsightDetectors(igUserId),
  ]);

  await logBrandAiCall({
    brandIgId: igUserId,
    endpoint: ENDPOINT,
    promptVersion: BRAND_OS_PROMPT_VERSIONS.insights,
    model: 'deterministic-rules',
    metadata: { mode: 'generate', pillars: pillars.length, findings: findings.length },
  });

  return json({ ok: true, pillars, findings });
};
