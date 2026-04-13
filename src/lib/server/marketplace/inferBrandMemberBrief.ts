import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { buildBrandMemberBundle } from './buildBrandIntelligenceBundles';
import { parseBrandMemberBrief } from './brandIntelligenceSchema';
import type { BrandMemberBrief } from '$lib/types/brandIntelligence';
import type { IdentityGraph } from '$lib/server/identity';
import type { InferenceIdentityCurrent } from '$lib/types/inferenceIdentity';
import type { IdentityIntelligencePayload } from '$lib/types/identityIntelligence';

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

const SYSTEM_PROMPT = `You are a brand-side audience tactician. You help marketers understand ONE person they might target for partnerships, offers, or campaigns.

Output ONLY valid JSON with exactly these keys (no markdown):
{
  "happening_now": "",
  "do_next": "",
  "missing": ""
}

Rules:
- Each value is ONE sharp line (no line breaks, no bullet prefixes). Max ~2 short sentences if needed.
- Voice: operator / growth — not therapy, not generic praise.
- happening_now: what is live in their life/behavior/signals right now that a brand should respect.
- do_next: the single best move a brand could make with this person (specific offer angle, channel, or partnership hook).
- missing: what they lack or underestimate that creates leverage for a brand (gap, blind spot, unmet need).
- Ground claims in the INPUT JSON only. If data is thin, say what is unknown and still give a concrete probe.`;

export async function inferBrandMemberBriefFromBundle(bundleJson: string): Promise<BrandMemberBrief | null> {
  const key = env.ANTHROPIC_API_KEY ?? '';
  if (!key.trim()) return null;

  const anthropic = new Anthropic({ apiKey: key, timeout: 120_000 });
  const userMessage = `INPUT JSON follows. Return only the JSON object with happening_now, do_next, missing.

${bundleJson}`;

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = res.content[0];
    const text = block?.type === 'text' ? block.text : '';
    return parseBrandMemberBrief(extractJsonObject(text));
  } catch (e) {
    console.error('[inferBrandMemberBrief]', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function runBrandMemberBrief(params: {
  graph: IdentityGraph;
  identitySummary: string;
  inferenceCurrent: InferenceIdentityCurrent | null;
  intelligencePayload: IdentityIntelligencePayload | null;
  recencyContext: string;
  matchReasonFromBrand?: string;
}): Promise<BrandMemberBrief | null> {
  const bundle = buildBrandMemberBundle(params);
  return inferBrandMemberBriefFromBundle(bundle);
}
