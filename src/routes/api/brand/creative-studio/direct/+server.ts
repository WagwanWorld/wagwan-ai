import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { getDirection } from '$lib/server/creative/orchestrator';
import { logTaste } from '$lib/server/creative/contextBuilder';

/**
 * Step 1: Claude creates the creative direction + a curated image prompt.
 * Returns the prompt for the user to review/edit before rendering.
 */
export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { copy, caption, lockedPhrases, brief } = body as {
    copy: string;
    caption?: string;
    lockedPhrases?: string[];
    brief?: string;
  };
  if (!copy?.trim()) throw error(400, 'Copy text is required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

  // Create generation record
  const genRes = await fetch(`${supabaseUrl}/rest/v1/creative_generations`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      brand_account_id: igUserId,
      mode: 'copy_first',
      format: 'static_4x5',
      copy_input: copy,
      brief: brief || null,
      status: 'in_progress',
      active_version: 1,
    }),
  });
  if (!genRes.ok) throw error(500, 'Failed to create generation record');
  const [generation] = await genRes.json();

  try {
    const result = await getDirection({
      brandIgId: igUserId,
      copy,
      caption,
      lockedPhrases,
      brief,
      generationId: generation.id,
    });

    await logTaste(igUserId, generation.id, 'generation', { copy, brief });

    return json({
      ok: true,
      generationId: generation.id,
      // Creative direction (shown to user)
      concept: result.direction.concept,
      designDirection: result.direction.designDirection.layout,
      whyThisWorks: result.direction.whyThisWorks,
      caption: result.direction.copy.caption,
      hashtags: result.direction.copy.hashtags,
      onImageText: result.direction.copy.onImage,
      // The curated image prompt (editable by user)
      imagePrompt: result.imagePrompt,
      // Full direction (sent back in render step)
      direction: result.direction,
      cost: { direction_usd: result.directionCost },
    });
  } catch (e) {
    await fetch(`${supabaseUrl}/rest/v1/creative_generations?id=eq.${generation.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'abandoned' }),
    });
    throw error(500, e instanceof Error ? e.message : 'Direction failed');
  }
};
