import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { assembleBrandBrief, logCost } from '$lib/server/creative/contextBuilder';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

interface CopyIdea {
  id: string;
  copy: string;
  caption: string;
  format: string;
  rationale: string;
}

/**
 * POST /api/brand/creative-studio/generate-copy
 * Mode 2 — Start from Scratch: generate N copy ideas from a user brief.
 */
export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { brief, count = 3, brandVoice } = body as {
    brief: string;
    count?: number;
    brandVoice?: string;
  };

  if (!brief?.trim()) throw error(400, 'Brief is required');

  const safeCount = Math.min(Math.max(Number(count) || 3, 1), 6);

  // Assemble brand context
  const brandBrief = await assembleBrandBrief(igUserId);

  const voice = brandVoice || brandBrief.brandVoice || 'Bold';
  const pillarsText = brandBrief.topPillars.length
    ? brandBrief.topPillars.map((p) => `- ${p.label}: ${p.description}`).join('\n')
    : 'No pillars available';

  const hooksText = brandBrief.topHookArchetypes.length
    ? brandBrief.topHookArchetypes
        .slice(0, 5)
        .map((h) => `- ${h.archetype} (avg engagement: ${h.avgEngagement})`)
        .join('\n')
    : 'No hook data available';

  const audienceText = brandBrief.audiencePersonas.length
    ? brandBrief.audiencePersonas
        .slice(0, 3)
        .map((a) => `- ${a.name}: ${a.description}`)
        .join('\n')
    : 'General audience';

  const systemPrompt = `You are a social media copywriter for this brand. Generate ${safeCount} distinct copy options for an Instagram post. Return only valid JSON, no markdown, no explanation.`;

  const userPrompt = `BRAND CONTEXT:
Brand Voice: ${voice}
Content Pillars:
${pillarsText}
Top Hook Archetypes:
${hooksText}
Audience Personas:
${audienceText}

BRAND VOICE: ${voice}

BRIEF: ${brief.trim()}

For each of the ${safeCount} options, return:
1. copy - the on-image text (headline + supporting text, concise, max 2-3 lines)
2. caption - full Instagram caption in brand voice (with emoji, 3-5 sentences)
3. format - recommended format, one of: static_4x5 | story_9x16 | carousel
4. rationale - 1 sentence: why this angle works for the brand

Return a JSON array only (no markdown fences):
[{ "id": "idea_1", "copy": "...", "caption": "...", "format": "static_4x5", "rationale": "..." }]`;

  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw error(500, 'Anthropic API key not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw error(502, `Claude request failed: ${errText.slice(0, 200)}`);
  }

  const claude = await res.json();
  const rawText: string = claude.content?.[0]?.text || '[]';

  let ideas: CopyIdea[] = [];
  try {
    // Strip any accidental markdown fences
    const clean = rawText.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    ideas = JSON.parse(clean);
    if (!Array.isArray(ideas)) throw new Error('Not an array');
  } catch {
    throw error(502, 'Claude returned malformed JSON — please try again');
  }

  // Ensure IDs are present
  ideas = ideas.map((idea, i) => ({ ...idea, id: idea.id || `idea_${i + 1}` }));

  // Log cost
  const inputTokens: number = claude.usage?.input_tokens || 0;
  const outputTokens: number = claude.usage?.output_tokens || 0;
  // Haiku pricing: $0.80/M input, $4/M output (as of 2025)
  const costUsd = (inputTokens * 0.0000008) + (outputTokens * 0.000004);

  await logCost(igUserId, `copy-ideas-${Date.now()}`, 'generate_copy_ideas', HAIKU_MODEL, inputTokens, outputTokens, costUsd);

  return json({
    ok: true,
    ideas,
    cost: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd },
  });
};
