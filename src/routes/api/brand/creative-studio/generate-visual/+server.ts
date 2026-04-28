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
  const { copy, caption, format, lockedPhrases, brief } = body as {
    copy: string;
    caption?: string;
    format?: string;
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
      format: format || 'static_4x5',
      copy_input: copy,
      brief: brief || null,
      status: 'in_progress',
      active_version: 1,
    }),
  });
  if (!genRes.ok) throw error(500, 'Failed to create generation record');
  const [generation] = await genRes.json();

  try {
    const result = await generateVisual({
      brandIgId: igUserId,
      copy,
      caption,
      format: format || 'static_4x5',
      lockedPhrases,
      brief,
      generationId: generation.id,
      version: 1,
    });

    await logTaste(igUserId, generation.id, 'generation', { copy, format, brief });

    return json({
      ok: true,
      generationId: generation.id,
      version: 1,
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
  } catch (e) {
    // Mark generation as abandoned on error
    await fetch(`${supabaseUrl}/rest/v1/creative_generations?id=eq.${generation.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'abandoned' }),
    });
    throw error(500, e instanceof Error ? e.message : 'Generation failed');
  }
};
