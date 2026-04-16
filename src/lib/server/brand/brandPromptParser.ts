import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import type { BrandQueryIntent } from './types';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a brand audience analyst. Extract structured targeting signals from brand prompts.
Return ONLY valid JSON matching the BrandQueryIntent schema. No markdown, no explanation.
Rules:
- target_artists: extract specific artist names (Bieber, Bad Bunny, AP Dhillon etc.)
- target_brands: extract brand names for competitor/adjacent matching
- target_aesthetics: use controlled vocabulary: minimalist, maximalist, streetwear, dark-academia, cottagecore, y2k, preppy, grunge, editorial, bohemian, hypebeast
- target_intent_type: infer from purchase-related language (purchase|action|identity|taste|growth)
- min_tier: default 3 unless brand says 'broad reach' (use 5) or 'exact match' (use 1)
- If brand mentions an artist, add their genre AND known cultural correlations to target_interests
- Always set max_results: 500, cohort_count: 4, include_correlations: true, explain_matches: true
- Return confidence: 0.0-1.0 based on how specific/actionable the prompt is`;

export async function parseBrandPrompt(prompt: string): Promise<BrandQueryIntent> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

  let parsed: Partial<BrandQueryIntent> = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    // If JSON parse fails, return safe defaults
    console.error('[brandPromptParser] JSON parse failed:', text.slice(0, 200));
  }

  return {
    ...parsed,
    min_tier: (parsed.min_tier ?? 3) as 1 | 2 | 3 | 4 | 5,
    max_results: parsed.max_results ?? 500,
    cohort_count: parsed.cohort_count ?? 4,
    include_correlations: parsed.include_correlations ?? true,
    explain_matches: parsed.explain_matches ?? true,
    raw_prompt: prompt,
    parsed_at: new Date().toISOString(),
    confidence: parsed.confidence ?? 0.7,
  };
}
