import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { getDirection, renderImage } from '$lib/server/creative/orchestrator';
import { logTaste } from '$lib/server/creative/contextBuilder';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { generationId, fromVersion, feedback, toggles } = body as {
    generationId: string;
    fromVersion: number;
    feedback: string;
    toggles?: Record<string, string>;
  };
  if (!generationId) throw error(400, 'generationId required');

  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

  const genRes = await fetch(`${supabaseUrl}/rest/v1/creative_generations?id=eq.${generationId}&brand_account_id=eq.${igUserId}&limit=1`, { headers });
  const gens = await genRes.json();
  if (!gens.length) throw error(404, 'Generation not found');
  const gen = gens[0];

  const verRes = await fetch(`${supabaseUrl}/rest/v1/creative_generation_versions?generation_id=eq.${generationId}&version=eq.${fromVersion}&limit=1`, { headers });
  const vers = await verRes.json();
  if (!vers.length) throw error(404, 'Version not found');

  const newVersion = fromVersion + 1;

  const revisionSuffix = [
    feedback,
    toggles ? Object.entries(toggles).map(([k, v]) => `${k}: ${v}`).join(', ') : '',
  ].filter(Boolean).join('. ');

  const revisedCopy = `${gen.copy_input}\n\nREVISION (v${fromVersion}→v${newVersion}): ${revisionSuffix}`;

  // Step 1: Get new direction
  const dirResult = await getDirection({
    brandIgId: igUserId,
    copy: revisedCopy,
    brief: gen.brief,
    generationId,
  });

  // Step 2: Render with the new direction's image prompt
  const renderResult = await renderImage({
    brandIgId: igUserId,
    imagePrompt: dirResult.imagePrompt,
    direction: dirResult.direction,
    generationId,
    version: newVersion,
  });

  await fetch(`${supabaseUrl}/rest/v1/creative_generations?id=eq.${generationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active_version: newVersion }),
  });

  await logTaste(igUserId, generationId, 'revision', { fromVersion, feedback, toggles });

  return json({
    ok: true,
    generationId,
    version: newVersion,
    concept: dirResult.direction.concept,
    designDirection: dirResult.direction.designDirection.layout,
    whyThisWorks: dirResult.direction.whyThisWorks,
    imageUrl: renderResult.imageUrl,
    caption: dirResult.direction.copy.caption,
    hashtags: dirResult.direction.copy.hashtags,
    format: 'static_4x5',
    dimensions: '1080x1350',
    qcReport: renderResult.qcReport,
    cost: { total_usd: dirResult.directionCost + renderResult.renderCost },
  });
};
