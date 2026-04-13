import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { IdentityGraph } from '$lib/server/identity';
import type { InferenceIdentityCurrent } from '$lib/types/inferenceIdentity';
import { IDENTITY_SNAPSHOT_SCHEMA_VERSION, type IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';
import { buildIdentityIntelligenceBundle } from './inferIdentityIntelligence';
import { parseIdentitySnapshotPayload } from './identitySnapshotSchema';

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

const SYSTEM_PROMPT = `You are an identity compression engine. Your job is to take a deep identity graph and compress it into a sharp, highly legible, emotionally resonant snapshot.

This snapshot should feel instantly recognizable to the user — like looking in a mirror that is slightly more honest than they expected.

## Rules

1. ONE-LINER MUST HIT
   It should feel like "damn that's me". Be specific, use proper nouns from the data (cities, niches, platforms).
   Bad: "Design-focused founder exploring community"
   Good: "Design-led founder building a community-first startup while quietly becoming a cultural voice between NYC and India"

2. USE TAGS, NOT SENTENCES
   For vibe, identity_tags, taste arrays: max 1–3 words per tag, no explanations, comma-separated style.

3. ADD EDGE — Include tension and contradiction. Builder vs creator. Taste vs scale. Ambition vs introspection. This is what makes the output feel real.

4. MAKE IT SOCIAL-READY — The one_liner and core_contradiction should feel like something someone would screenshot or put in their bio.

5. BE SPECIFIC, NOT GENERIC
   Bad: "minimalist"
   Good: "editorial minimalism", "warm modern", "NYC soft light"

6. CAPTURE ASPIRATION + REALITY — The snapshot should hold both where they are and where they are going.

7. BRAND-LEGIBLE — The archetype must be 2–4 words that a brand could immediately act on (e.g. "Founder–Creator Hybrid", "Cultural Tastemaker", "Builder in Transition").

## Output contract

Return ONLY one JSON object (no markdown). Required fields:

{
  "one_liner": "",
  "archetype": "",
  "vibe": [],
  "identity_tags": [],
  "current_mode": "",
  "core_contradiction": "",
  "aesthetic_profile": {
    "visual": [],
    "brands": [],
    "spaces": []
  },
  "shopping_style": {
    "type": "",
    "signals": []
  },
  "taste": {
    "music": [],
    "media": [],
    "cultural": []
  },
  "social_identity": {
    "how_people_see_you": "",
    "actual_you": ""
  },
  "status": {
    "level": "",
    "direction": ""
  }
}

- vibe: 4–10 tags. These are the loudest/most personal signals.
- identity_tags: 6–14 tags. Broader identity map.
- current_mode: single word or short phrase (e.g. "building", "executing", "exploring", "transitioning").
- core_contradiction: one sentence capturing the central tension (e.g. "Building in public but invisible professionally").
- aesthetic_profile.visual: 3–6 aesthetic descriptors (e.g. "editorial minimalism", "warm modern").
- status.level: e.g. "early stage", "growth stage", "established". status.direction: e.g. "rising", "pivoting", "consolidating".
- All string fields must be non-empty.`;

export async function inferIdentitySnapshotFromBundle(bundleJson: string): Promise<IdentitySnapshotWrapper | null> {
  const key = env.ANTHROPIC_API_KEY ?? '';
  if (!key.trim()) return null;

  const anthropic = new Anthropic({ apiKey: key, timeout: 120_000 });

  const userMessage = `INPUT (JSON). Produce the identity snapshot object ONLY.

${bundleJson}`;

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = res.content[0];
    const text = block?.type === 'text' ? block.text : '';
    const raw = extractJsonObject(text);
    const payload = parseIdentitySnapshotPayload(raw);
    if (!payload) {
      console.error('[inferIdentitySnapshot] parse failed, raw:', text.slice(0, 400));
      return null;
    }
    return {
      version: IDENTITY_SNAPSHOT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      payload,
    };
  } catch (e) {
    console.error('[inferIdentitySnapshot]', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function runIdentitySnapshotFromInputs(params: {
  graph: IdentityGraph;
  identitySummary: string;
  inferenceCurrent: InferenceIdentityCurrent | null;
  recencyContext: string;
}): Promise<IdentitySnapshotWrapper | null> {
  const bundle = buildIdentityIntelligenceBundle(
    params.graph,
    params.identitySummary,
    params.inferenceCurrent,
    params.recencyContext,
  );
  return inferIdentitySnapshotFromBundle(bundle);
}
