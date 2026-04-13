import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { buildBrandAudienceCohortBundle } from './buildBrandIntelligenceBundles';
import { parseBrandAudienceIntel } from './brandIntelligenceSchema';
import type { BrandAudienceIntel } from '$lib/types/brandIntelligence';
import type { ParsedAudience } from './types';
import type { ProfileRowForMatch } from './audienceMatch';

const MODEL = 'claude-haiku-4-5-20251001';

function stripJsonFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function extractJsonObject(text: string): unknown {
  const stripped = stripJsonFence(text);
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are an audience intelligence engine for brands. Given a discovered cohort (structured audience + member sketches), extract monetization insight.

Output ONLY valid JSON (no markdown):
{
  "trying_to_achieve": "",
  "struggling_with": "",
  "content_that_converts": "",
  "will_pay_for": ""
}

Rules:
- Specific, monetizable, actionable. No generic trends ("Gen Z loves authenticity").
- trying_to_achieve: what this cohort is actually optimizing for (status, relief, belonging, momentum, craft, etc.) in concrete terms.
- struggling_with: friction, shame points, or structural blockers implied by the cohort data.
- content_that_converts: formats, hooks, or narrative angles that would move this cohort (not "influencer marketing").
- will_pay_for: product class, feature bundle, or paid wedge most likely to pull wallet — name it like a PM.
- 1–3 sentences per field max. Ground in cohort_members and human_summary; synthesize across the set.`;

export async function inferBrandAudienceIntelFromBundle(bundleJson: string): Promise<BrandAudienceIntel | null> {
  const key = env.ANTHROPIC_API_KEY ?? '';
  if (!key.trim()) return null;

  const anthropic = new Anthropic({ apiKey: key, timeout: 120_000 });
  const userMessage = `INPUT JSON follows. Return only the four-field JSON object.

${bundleJson}`;

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = res.content[0];
    const text = block?.type === 'text' ? block.text : '';
    return parseBrandAudienceIntel(extractJsonObject(text));
  } catch (e) {
    console.error('[inferBrandAudienceIntel]', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function runBrandAudienceIntel(params: {
  structured: ParsedAudience;
  keyTraits: { tag: string; count: number }[];
  members: ProfileRowForMatch[];
  memberExtras: Map<
    string,
    { match_score: number; match_reason: string; preview_tags: string[]; identity_summary: string }
  >;
  maxMembers: number;
}): Promise<BrandAudienceIntel | null> {
  const bundle = buildBrandAudienceCohortBundle(
    params.structured,
    params.keyTraits,
    params.members,
    params.memberExtras,
    params.maxMembers,
  );
  return inferBrandAudienceIntelFromBundle(bundle);
}
