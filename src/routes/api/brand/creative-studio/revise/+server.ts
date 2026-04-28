import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { generateVisual } from '$lib/server/creative/orchestrator';
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

  // Get generation + current version
  const genRes = await fetch(`${supabaseUrl}/rest/v1/creative_generations?id=eq.${generationId}&brand_account_id=eq.${igUserId}&limit=1`, { headers });
  const gens = await genRes.json();
  if (!gens.length) throw error(404, 'Generation not found');
  const gen = gens[0];

  // Get the version being revised
  const verRes = await fetch(`${supabaseUrl}/rest/v1/creative_generation_versions?generation_id=eq.${generationId}&version=eq.${fromVersion}&limit=1`, { headers });
  const vers = await verRes.json();
  if (!vers.length) throw error(404, 'Version not found');
  const prevVersion = vers[0];

  const newVersion = fromVersion + 1;

  // Build revision context from previous direction + feedback
  const prevDirection = prevVersion.direction_payload;
  const revisionSuffix = [
    feedback,
    toggles ? Object.entries(toggles).map(([k, v]) => `${k}: ${v}`).join(', ') : '',
  ].filter(Boolean).join('. ');

  const revisedCopy = `${gen.copy_input}\n\nREVISION REQUEST (from version ${fromVersion}): ${revisionSuffix}\n\nPrevious design direction was: ${prevDirection.designDirection?.layout || 'unknown'}. Adjust based on the revision feedback while maintaining brand consistency.`;

  const result = await generateVisual({
    brandIgId: igUserId,
    copy: revisedCopy,
    brief: gen.brief,
    generationId,
    version: newVersion,
  });

  // Update active version
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
    concept: result.direction.concept,
    designDirection: result.direction.designDirection.layout,
    whyThisWorks: result.direction.whyThisWorks,
    imageUrl: result.imageUrl,
    caption: result.direction.copy.caption,
    hashtags: result.direction.copy.hashtags,
    format: 'static_4x5',
    dimensions: '1080x1350',
    qcReport: result.qcReport,
    cost: { total_usd: result.totalCost },
  });
};
