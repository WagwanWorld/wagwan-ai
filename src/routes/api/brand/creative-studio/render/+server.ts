import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { renderImage } from '$lib/server/creative/orchestrator';
import type { CreativeDirection } from '$lib/server/creative/directionPrompt';

/**
 * Step 2: Takes the user-approved (possibly edited) image prompt
 * and renders via Gemini → Satori composite → QC.
 */
export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { generationId, imagePrompt, direction, version } = body as {
    generationId: string;
    imagePrompt: string;
    direction: CreativeDirection;
    version?: number;
  };

  if (!generationId) throw error(400, 'generationId required');
  if (!imagePrompt?.trim()) throw error(400, 'imagePrompt required');
  if (!direction) throw error(400, 'direction required');

  try {
    const result = await renderImage({
      brandIgId: igUserId,
      imagePrompt,
      direction,
      generationId,
      version: version || 1,
    });

    return json({
      ok: true,
      generationId,
      version: version || 1,
      imageUrl: result.imageUrl,
      qcReport: result.qcReport,
      cost: { render_usd: result.renderCost },
    });
  } catch (e) {
    throw error(500, e instanceof Error ? e.message : 'Render failed');
  }
};
