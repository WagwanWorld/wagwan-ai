# Brand Matching Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a conversational AI brand matching agent that interviews brands, extracts structured briefs, scores creators using a weighted formula, and delivers ranked shortlists with outreach brief generation.

**Architecture:** A new SSE streaming endpoint (`/api/brand/match-agent`) orchestrates a Claude conversation with 3 tools: `extract_brand_brief`, `run_creator_match`, and `generate_outreach_brief`. The system prompt is the founder's brand matching agent prompt. Creator scoring is deterministic code (no LLM) — Claude decides when to score, code executes it. The brand portal gets a chat-style UI alongside the existing search.

**Tech Stack:** SvelteKit, TypeScript, Anthropic SDK (Haiku), Supabase, SSE streaming

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/server/marketplace/brandMatchAgent.ts` | System prompt + tool definitions + types |
| Create | `src/lib/server/marketplace/creatorScoring.ts` | Build portraits, score, disqualify, rank |
| Create | `src/routes/api/brand/match-agent/+server.ts` | SSE streaming endpoint with tool execution |
| Create | `src/lib/components/brands/MatchAgentChat.svelte` | Chat UI component for brand portal |
| Modify | `src/routes/brands/portal/+page.svelte` | Add chat interface tab |

---

### Task 1: Brand Match Agent Module (System Prompt + Tools + Types)

**Files:**
- Create: `src/lib/server/marketplace/brandMatchAgent.ts`

- [ ] **Step 1: Create the module**

Create `src/lib/server/marketplace/brandMatchAgent.ts` with the full system prompt, tool definitions, and types. This is a large file but it's all constants and type definitions.

```typescript
/**
 * Brand Matching Agent — system prompt, tool definitions, and types.
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js';

// ── Types ──

export interface BrandBrief {
  product_summary: string;
  buyer_roles: string[];
  buyer_stage: string[];
  buyer_identity_signals: string[];
  bad_fit_signals: string[];
  campaign_intent: 'awareness' | 'trust' | 'conversion' | 'signal';
  content_themes_needed: string[];
  budget_tier: 'nano' | 'micro' | 'mid' | 'macro';
  timeline: string;
  geography: string[];
  success_metric: string;
  brand_voice_match: string;
}

export interface CreatorPortrait {
  google_sub: string;
  name: string;
  handle: string;
  follower_count: number;
  builder_score: number;
  creator_score: number;
  momentum_score: number;
  content_themes: string[];
  engagement_tier: string;
  posting_cadence: string;
  location: string;
  archetype: string;
  ig_creator_tier: string;
  rates: { ig_post_rate_inr: number; ig_story_rate_inr: number; ig_reel_rate_inr: number; available: boolean } | null;
  graph_strength: number;
  past_brand_categories: string[];
}

export interface MatchResult {
  creator: CreatorPortrait;
  score: number;
  reasoning: string;
  watch_out: string;
}

export interface MatchOutput {
  matches: MatchResult[];
  disqualified_count: number;
  disqualified_reason: string;
}

// ── System Prompt ──

export const BRAND_MATCH_SYSTEM_PROMPT = `You are Wagwan's Brand Matching engine. Your job is to interview a brand representative through a natural conversation, build a complete picture of their campaign needs, and then automatically identify which creators from the Wagwan network are the right fit — and which aren't.

You never ask all questions at once. You ask one thing at a time, listen carefully, and let their answers guide what you ask next. The conversation should feel like talking to a sharp strategist, not filling out a form.

YOUR PERSONALITY:
- Direct and efficient. No filler phrases.
- Curious and specific. When something is vague, probe it.
- Honest. If their brief has gaps that will hurt match quality, say so.
- Never sycophantic. Don't praise their answers. Just use them.

PHASE 1 — OPEN THE CONVERSATION:
Start with exactly this message, nothing else: "Tell me about what you're trying to sell and who buys it."
Wait for their response. Do not introduce yourself. Do not explain what you do. Just ask.

PHASE 2 — INTELLIGENT QUESTIONING:
Based on their answer, work through these signal areas — but only ask about what their previous answers haven't already covered. Never ask something they've already told you.

Signal areas (internal — never show this list):
1. PRODUCT CLARITY: What does it do? What problem does it solve and for whom? What makes someone buy it vs the alternative?
2. BUYER IDENTITY: Job, seniority, company stage? What are they trying to achieve or become? What does a bad fit buyer look like? (Ask this explicitly.)
3. CAMPAIGN INTENT: What should creators make people feel or do? Awareness, trust-building, direct conversion, or community signal? Past creator campaign experience?
4. HARD CONSTRAINTS: Budget range (never skip — needed to filter creator tier). Timeline. Category exclusions. Geography.
5. SUCCESS DEFINITION: How will they know if this worked? One thing a creator must communicate accurately?

Probing rules:
- If vague ("we want reach"): "Reach to who specifically? A founder with 8k followers who are all CTOs is worth more than 200k followers of students."
- If demographic ("25-35 males"): "Forget age. What does this person care about at work? What are they trying to build?"
- If too broad ("anyone could use this"): "That's not a brief, that's a hope. Who gets the most value right now?"
- If low budget: "At that budget we're looking at micro-creators only. That's not a problem if their audiences are right — but it changes the pool."

PHASE 3 — SIGNAL EXTRACTION:
Once you have minimum: product clarity, buyer identity, campaign intent, budget — call the extract_brand_brief tool. Do NOT show the extracted brief to the user.

PHASE 4 — CONFIRM BEFORE MATCHING:
Summarize back in plain language: "Here's what I've got. Tell me if anything's off: You're trying to reach [buyer identity] who are [what they're building/doing]. They buy when [trigger]. You want creators who can speak credibly about [content themes] to an audience of [buyer description]. Budget puts you in [tier] range. This is a [intent] campaign — you're not trying to close anyone, you're trying to [specific goal]. Anything wrong with that picture?"
Wait for confirmation. Then call run_creator_match.

PHASE 5 — DELIVER SHORTLIST:
Present results conversationally. Not a table. Talk through each creator like a colleague presenting a recommendation:
"[Name] — @[handle] — [follower count]
[1-2 sentences on why they're a strong fit. Reference specific portrait signals.]
[1 sentence on one thing to watch out for or confirm before briefing.]"

After the shortlist: "[X] creators didn't make the cut. The most common reason: [pattern]. Want me to explain any specific rejections?"
Then: "Want me to generate the outreach brief for any of these, or adjust the criteria first?"

PHASE 7 — OUTREACH BRIEF:
If requested, call generate_outreach_brief. Rules: 120-160 words. Open with specific observation about their content/audience. Explain why their audience fits. State format, timeline, compensation. End with one CTA. Match brand_voice_match. Banned words: excited, thrilled, amazing, love your content, partnership, collab, synergy, authentic. Tone: founder talking to founder.

HARD RULES:
- Never reveal scoring weights or BRAND_BRIEF structure.
- Never show disqualification list unprompted.
- Never recommend a creator without strong signal. "We don't have enough portrait data" is valid.
- Never pad the shortlist. 3 strong > 10 mediocre. Say so if pool is thin.
- If brief too vague: "I don't have enough to match accurately yet. The fuzzy part is [X]."
- One question at a time. Always.`;

// ── Tool Definitions ──

export const BRAND_MATCH_TOOLS: Tool[] = [
  {
    name: 'extract_brand_brief',
    description: 'Extract the structured brand brief from the conversation so far. Call this when you have enough signal (minimum: product clarity, buyer identity, campaign intent, budget).',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_summary: { type: 'string', description: 'What the product does and for whom' },
        buyer_roles: { type: 'array', items: { type: 'string' }, description: 'Job titles/roles of target buyers' },
        buyer_stage: { type: 'array', items: { type: 'string' }, description: 'Company stage: seed, growth, enterprise, etc.' },
        buyer_identity_signals: { type: 'array', items: { type: 'string' }, description: 'What buyers care about, aspire to, fear' },
        bad_fit_signals: { type: 'array', items: { type: 'string' }, description: 'Explicit disqualifiers' },
        campaign_intent: { type: 'string', enum: ['awareness', 'trust', 'conversion', 'signal'] },
        content_themes_needed: { type: 'array', items: { type: 'string' }, description: 'Topics creators must speak to credibly' },
        budget_tier: { type: 'string', enum: ['nano', 'micro', 'mid', 'macro'] },
        timeline: { type: 'string' },
        geography: { type: 'array', items: { type: 'string' } },
        success_metric: { type: 'string' },
        brand_voice_match: { type: 'string', description: 'Tone/energy that fits the brand' },
      },
      required: ['product_summary', 'buyer_roles', 'buyer_identity_signals', 'campaign_intent', 'content_themes_needed', 'budget_tier'],
    },
  },
  {
    name: 'run_creator_match',
    description: 'Score all creators in the Wagwan network against the confirmed brand brief and return the shortlist. Call this after the brand confirms the brief summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max creators to return (default 5)' },
      },
      required: [],
    },
  },
  {
    name: 'generate_outreach_brief',
    description: 'Generate a 120-160 word outreach brief for a specific creator. Call when the brand requests outreach for a creator from the shortlist.',
    input_schema: {
      type: 'object' as const,
      properties: {
        creator_name: { type: 'string' },
        creator_handle: { type: 'string' },
        match_reasoning: { type: 'string' },
      },
      required: ['creator_name'],
    },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/marketplace/brandMatchAgent.ts
git commit -m "feat: add brand match agent system prompt, tools, and types"
```

---

### Task 2: Creator Scoring Engine

**Files:**
- Create: `src/lib/server/marketplace/creatorScoring.ts`

- [ ] **Step 1: Create the scoring module**

Create `src/lib/server/marketplace/creatorScoring.ts`:

```typescript
/**
 * Creator scoring engine — builds portraits from DB, scores against brand brief.
 * Deterministic code, no LLM calls.
 */

import { getServiceSupabase } from '../supabase';
import { computeGraphStrength } from './graphStrength';
import { flattenIdentityGraph } from './identityGraphTags';
import type { BrandBrief, CreatorPortrait, MatchResult, MatchOutput } from './brandMatchAgent';

// ── Budget Tier Follower Ranges ──

const TIER_RANGES: Record<string, [number, number]> = {
  nano: [500, 5_000],
  micro: [5_000, 25_000],
  mid: [25_000, 100_000],
  macro: [100_000, Infinity],
};

// ── Build Portraits from DB ──

export async function loadCreatorPortraits(): Promise<CreatorPortrait[]> {
  const sb = getServiceSupabase();

  const [profileRes, ratesRes, interactionsRes] = await Promise.all([
    sb.from('user_profiles').select('google_sub, name, profile_data, identity_graph').limit(1000),
    sb.from('creator_rates').select('*').eq('available', true),
    sb.from('campaign_interactions').select('user_google_sub, campaign_id'),
  ]);

  const profiles = profileRes.data ?? [];
  const ratesMap = new Map<string, any>();
  for (const r of ratesRes.data ?? []) {
    ratesMap.set(r.user_google_sub, {
      ig_post_rate_inr: r.ig_post_rate_inr,
      ig_story_rate_inr: r.ig_story_rate_inr,
      ig_reel_rate_inr: r.ig_reel_rate_inr,
      available: r.available,
    });
  }

  // Count past brand categories per user
  const pastCategories = new Map<string, string[]>();
  for (const i of interactionsRes.data ?? []) {
    const sub = i.user_google_sub as string;
    if (!pastCategories.has(sub)) pastCategories.set(sub, []);
  }

  return profiles.map((row): CreatorPortrait => {
    const graph = (row.identity_graph ?? {}) as Record<string, unknown>;
    const profileData = (row.profile_data ?? {}) as Record<string, unknown>;
    const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;
    const inference = graph.inferenceIdentity as any;
    const snapshot = graph.identitySnapshot as any;
    const derived = inference?.current?.derived_signals;

    const strength = computeGraphStrength(graph, profileData);

    return {
      google_sub: row.google_sub as string,
      name: (row.name as string) || '',
      handle: (ig?.username as string) || '',
      follower_count: (ig?.followersCount as number) || 0,
      builder_score: derived?.builder_score ?? 0,
      creator_score: derived?.creator_score ?? 0,
      momentum_score: derived?.momentum_score ?? 0,
      content_themes: flattenIdentityGraph(graph).slice(0, 15),
      engagement_tier: (graph.engagementTier as string) || '',
      posting_cadence: (graph.igPostingCadence as string) || '',
      location: (graph.city as string) || (profileData.city as string) || '',
      archetype: snapshot?.payload?.archetype || '',
      ig_creator_tier: (graph.igCreatorTier as string) || '',
      rates: ratesMap.get(row.google_sub as string) || null,
      graph_strength: strength.score,
      past_brand_categories: pastCategories.get(row.google_sub as string) || [],
    };
  });
}

// ── Scoring ──

function credibilityScore(creator: CreatorPortrait, brief: BrandBrief): number {
  const needed = new Set(brief.content_themes_needed.map(t => t.toLowerCase()));
  const has = new Set(creator.content_themes.map(t => t.toLowerCase()));
  if (!needed.size) return 0.5;

  let overlap = 0;
  for (const n of needed) {
    for (const h of has) {
      if (h.includes(n) || n.includes(h)) { overlap++; break; }
    }
  }
  return Math.min(1, overlap / needed.size);
}

function audienceScore(creator: CreatorPortrait, brief: BrandBrief): number {
  // Infer audience composition from creator's content themes + archetype
  const signals = [
    ...creator.content_themes,
    creator.archetype,
    creator.engagement_tier,
    creator.location,
  ].map(s => s.toLowerCase());

  const buyerSignals = brief.buyer_identity_signals.map(s => s.toLowerCase());
  if (!buyerSignals.length) return 0.5;

  let match = 0;
  for (const b of buyerSignals) {
    for (const s of signals) {
      if (s.includes(b) || b.includes(s)) { match++; break; }
    }
  }

  let geo = 0;
  if (brief.geography.length) {
    const geoLower = brief.geography.map(g => g.toLowerCase());
    if (geoLower.some(g => creator.location.toLowerCase().includes(g))) geo = 0.2;
  }

  return Math.min(1, (match / Math.max(1, buyerSignals.length)) + geo);
}

function engagementScore(creator: CreatorPortrait): number {
  let score = 0.4;
  const tier = creator.engagement_tier.toLowerCase();
  if (tier.includes('high') || tier.includes('rising')) score += 0.25;
  if (creator.graph_strength > 65) score += 0.15;
  if (creator.posting_cadence.includes('daily') || creator.posting_cadence.includes('3-4')) score += 0.1;
  return Math.min(1, score);
}

function momentumNorm(creator: CreatorPortrait): number {
  return Math.min(1, creator.momentum_score / 100);
}

// ── Disqualification ──

function isDisqualified(creator: CreatorPortrait, brief: BrandBrief): string | null {
  // Posting cadence too low
  const cadence = creator.posting_cadence.toLowerCase();
  if (cadence.includes('inactive') || cadence.includes('rarely')) return 'inactive posting';

  // Graph strength too low
  if (creator.graph_strength < 30) return 'insufficient portrait data';

  // Follower count outside tier
  const range = TIER_RANGES[brief.budget_tier];
  if (range) {
    if (creator.follower_count < range[0] || creator.follower_count > range[1]) {
      return `follower count outside ${brief.budget_tier} tier range`;
    }
  }

  // Not available for deals
  if (!creator.rates?.available) return 'not available for deals';

  // Bad fit signals
  const badFit = brief.bad_fit_signals.map(s => s.toLowerCase());
  const creatorSignals = creator.content_themes.map(t => t.toLowerCase()).join(' ');
  for (const bad of badFit) {
    if (creatorSignals.includes(bad)) return `overlaps with bad-fit signal: ${bad}`;
  }

  return null;
}

// ── Main Matching Function ──

export function scoreCreators(
  portraits: CreatorPortrait[],
  brief: BrandBrief,
  limit = 5,
): MatchOutput {
  const qualified: { portrait: CreatorPortrait; score: number }[] = [];
  let disqualifiedCount = 0;
  const disqualReasons: Record<string, number> = {};

  for (const creator of portraits) {
    const dqReason = isDisqualified(creator, brief);
    if (dqReason) {
      disqualifiedCount++;
      disqualReasons[dqReason] = (disqualReasons[dqReason] ?? 0) + 1;
      continue;
    }

    const cred = credibilityScore(creator, brief);
    const aud = audienceScore(creator, brief);
    const eng = engagementScore(creator);
    const mom = momentumNorm(creator);

    const score = Math.round((cred * 0.30 + aud * 0.35 + eng * 0.20 + mom * 0.15) * 100);
    qualified.push({ portrait: creator, score });
  }

  qualified.sort((a, b) => b.score - a.score);
  const topMatches = qualified.slice(0, limit);

  const matches: MatchResult[] = topMatches.map(({ portrait, score }) => ({
    creator: portrait,
    score,
    reasoning: buildReasoning(portrait, brief, score),
    watch_out: buildWatchOut(portrait, brief),
  }));

  const topDqReason = Object.entries(disqualReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'various reasons';

  return {
    matches,
    disqualified_count: disqualifiedCount,
    disqualified_reason: topDqReason,
  };
}

function buildReasoning(creator: CreatorPortrait, brief: BrandBrief, score: number): string {
  const themes = creator.content_themes.filter(t =>
    brief.content_themes_needed.some(n => t.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(t.toLowerCase()))
  ).slice(0, 3);
  const themeStr = themes.length ? `Posts credibly about ${themes.join(', ')}.` : '';
  const archStr = creator.archetype ? `${creator.archetype}.` : '';
  const locStr = brief.geography.length && creator.location ? `Based in ${creator.location}.` : '';
  return [archStr, themeStr, locStr, `${creator.follower_count.toLocaleString()} followers.`].filter(Boolean).join(' ');
}

function buildWatchOut(creator: CreatorPortrait, brief: BrandBrief): string {
  if (creator.graph_strength < 50) return 'Portrait data is limited — verify their content directly.';
  if (creator.momentum_score < 30) return 'Growth has slowed recently — check recent engagement.';
  if (creator.posting_cadence.includes('1-2')) return 'Posts infrequently — confirm they can meet timeline.';
  return 'Review their recent posts to confirm brand voice alignment.';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/marketplace/creatorScoring.ts
git commit -m "feat: add creator scoring engine with weighted formula and disqualification"
```

---

### Task 3: Brand Match Agent SSE Endpoint

**Files:**
- Create: `src/routes/api/brand/match-agent/+server.ts`

- [ ] **Step 1: Create the streaming endpoint**

Create `src/routes/api/brand/match-agent/+server.ts`:

```typescript
/**
 * POST /api/brand/match-agent
 *
 * SSE streaming endpoint for the brand matching conversation.
 * Brand sends messages, agent responds with questions or results.
 * Uses 3 tools: extract_brand_brief, run_creator_match, generate_outreach_brief.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import {
  BRAND_MATCH_SYSTEM_PROMPT,
  BRAND_MATCH_TOOLS,
  type BrandBrief,
} from '$lib/server/marketplace/brandMatchAgent';
import { loadCreatorPortraits, scoreCreators } from '$lib/server/marketplace/creatorScoring';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 90_000 });

export const POST: RequestHandler = async ({ request }) => {
  let body: {
    message: string;
    history?: { role: string; text: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message?.trim()) return json({ ok: false, error: 'empty_message' }, { status: 400 });

  // Build messages array for Claude
  const messages: Anthropic.MessageParam[] = [];

  // Add conversation history
  for (const h of history) {
    messages.push({
      role: h.role === 'agent' ? 'assistant' : 'user',
      content: h.text,
    });
  }

  // Add current message
  messages.push({ role: 'user', content: message });

  // State for tool results
  let extractedBrief: BrandBrief | null = null;

  const encoder = new TextEncoder();
  function sse(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Call Claude with tools
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system: BRAND_MATCH_SYSTEM_PROMPT,
          tools: BRAND_MATCH_TOOLS,
          messages,
        });

        // Process response content blocks
        let agentText = '';

        for (const block of response.content) {
          if (block.type === 'text') {
            agentText += block.text;
            controller.enqueue(sse('text_delta', { delta: block.text }));
          } else if (block.type === 'tool_use') {
            const toolName = block.name;
            const toolInput = block.input as Record<string, unknown>;

            if (toolName === 'extract_brand_brief') {
              extractedBrief = toolInput as unknown as BrandBrief;
              controller.enqueue(sse('brief', { brief: extractedBrief }));

              // Continue conversation — Claude needs the tool result to proceed
              const followUp = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 2000,
                system: BRAND_MATCH_SYSTEM_PROMPT,
                tools: BRAND_MATCH_TOOLS,
                messages: [
                  ...messages,
                  { role: 'assistant', content: response.content },
                  { role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: 'Brief extracted successfully. Now summarize it back to the brand for confirmation, then call run_creator_match when they confirm.' }] },
                ],
              });

              for (const fb of followUp.content) {
                if (fb.type === 'text') {
                  agentText += fb.text;
                  controller.enqueue(sse('text_delta', { delta: fb.text }));
                }
              }
            } else if (toolName === 'run_creator_match') {
              controller.enqueue(sse('status', { text: 'Scoring creators...' }));

              const portraits = await loadCreatorPortraits();
              const limit = (toolInput.limit as number) || 5;
              const results = scoreCreators(portraits, extractedBrief!, limit);

              controller.enqueue(sse('matches', { results }));

              // Continue conversation with match results
              const matchSummary = results.matches.map(m =>
                `${m.creator.name} (@${m.creator.handle}) — ${m.creator.follower_count} followers — Score: ${m.score}/100 — ${m.reasoning} — Watch out: ${m.watch_out}`
              ).join('\n\n');

              const followUp = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 2000,
                system: BRAND_MATCH_SYSTEM_PROMPT,
                tools: BRAND_MATCH_TOOLS,
                messages: [
                  ...messages,
                  { role: 'assistant', content: response.content },
                  { role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: `Match results:\n\n${matchSummary}\n\nDisqualified: ${results.disqualified_count} creators. Top reason: ${results.disqualified_reason}.\n\nPresent these results conversationally as specified in your instructions.` }] },
                ],
              });

              for (const fb of followUp.content) {
                if (fb.type === 'text') {
                  agentText += fb.text;
                  controller.enqueue(sse('text_delta', { delta: fb.text }));
                }
              }
            } else if (toolName === 'generate_outreach_brief') {
              const creator = toolInput.creator_name as string;
              const brief = `Generate a 120-160 word outreach brief for ${creator}. Brand brief: ${extractedBrief?.product_summary ?? ''}. Campaign intent: ${extractedBrief?.campaign_intent ?? ''}. Voice: ${extractedBrief?.brand_voice_match ?? 'professional'}.`;

              controller.enqueue(sse('outreach', { creator_name: creator, generating: true }));

              // Continue with outreach generation
              const followUp = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 500,
                system: BRAND_MATCH_SYSTEM_PROMPT,
                tools: BRAND_MATCH_TOOLS,
                messages: [
                  ...messages,
                  { role: 'assistant', content: response.content },
                  { role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: `Now write the outreach brief for ${creator}. Follow the rules in your instructions exactly.` }] },
                ],
              });

              for (const fb of followUp.content) {
                if (fb.type === 'text') {
                  agentText += fb.text;
                  controller.enqueue(sse('text_delta', { delta: fb.text }));
                }
              }
            }
          }
        }

        controller.enqueue(sse('message', { text: agentText }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[MatchAgent] Error:', msg);
        controller.enqueue(sse('error', { text: 'Something went wrong — please try again.' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/brand/match-agent/+server.ts
git commit -m "feat(api): add brand match agent SSE endpoint with tool execution"
```

---

### Task 4: Brand Portal Chat UI Component

**Files:**
- Create: `src/lib/components/brands/MatchAgentChat.svelte`

- [ ] **Step 1: Create the chat component**

Create `src/lib/components/brands/MatchAgentChat.svelte`:

```svelte
<script lang="ts">
  import { onMount, tick } from 'svelte';

  type Message = { role: 'user' | 'agent'; text: string };

  let messages: Message[] = [];
  let input = '';
  let loading = false;
  let chatEl: HTMLDivElement;

  async function scrollToBottom() {
    await tick();
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  }

  onMount(() => {
    // Agent opens the conversation
    messages = [{ role: 'agent', text: 'Tell me about what you\'re trying to sell and who buys it.' }];
  });

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    input = '';
    messages = [...messages, { role: 'user', text }];
    loading = true;
    await scrollToBottom();

    try {
      const res = await fetch('/api/brand/match-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(0, -1), // exclude the message we just added
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let agentText = '';
      let carry = '';

      // Add placeholder for agent response
      messages = [...messages, { role: 'agent', text: '' }];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });
        const lines = carry.split('\n');
        carry = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              // Check what event this is from the preceding event: line
            } catch {}
          }
          if (line.startsWith('event: text_delta')) {
            // Next data line has the delta
          }
        }

        // Simpler approach: parse all SSE events
        const events = carry.split('\n\n');
        carry = events.pop() ?? '';
        for (const ev of events) {
          const eventMatch = ev.match(/event: (\w+)\ndata: (.*)/s);
          if (!eventMatch) continue;
          const [, eventType, dataStr] = eventMatch;
          try {
            const data = JSON.parse(dataStr);
            if (eventType === 'text_delta' && data.delta) {
              agentText += data.delta;
              messages = [...messages.slice(0, -1), { role: 'agent', text: agentText }];
              await scrollToBottom();
            } else if (eventType === 'message' && data.text) {
              agentText = data.text;
              messages = [...messages.slice(0, -1), { role: 'agent', text: agentText }];
            }
          } catch {}
        }
      }

      // Ensure final message is set
      if (agentText) {
        messages = [...messages.slice(0, -1), { role: 'agent', text: agentText }];
      }
    } catch (e) {
      messages = [...messages, { role: 'agent', text: 'Something went wrong. Please try again.' }];
    } finally {
      loading = false;
      await scrollToBottom();
    }
  }
</script>

<div class="mac-root">
  <div class="mac-messages" bind:this={chatEl}>
    {#each messages as msg}
      <div class="mac-msg" class:mac-msg--user={msg.role === 'user'} class:mac-msg--agent={msg.role === 'agent'}>
        <p class="mac-msg-text">{msg.text}</p>
      </div>
    {/each}
    {#if loading}
      <div class="mac-msg mac-msg--agent">
        <p class="mac-msg-text mac-typing">Thinking...</p>
      </div>
    {/if}
  </div>
  <form class="mac-input-row" on:submit|preventDefault={send}>
    <input
      type="text"
      class="mac-input"
      bind:value={input}
      placeholder="Describe your product, audience, or campaign goals..."
      disabled={loading}
    />
    <button class="mac-send" type="submit" disabled={loading || !input.trim()}>Send</button>
  </form>
</div>

<style>
  .mac-root {
    display: flex; flex-direction: column; height: 100%;
    background: var(--bg-primary); border-radius: 16px;
    border: 1px solid var(--border-subtle); overflow: hidden;
  }
  .mac-messages {
    flex: 1; overflow-y: auto; padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
    scrollbar-width: none;
  }
  .mac-messages::-webkit-scrollbar { display: none; }

  .mac-msg { max-width: 85%; }
  .mac-msg--user { align-self: flex-end; }
  .mac-msg--agent { align-self: flex-start; }

  .mac-msg-text {
    padding: 12px 16px; border-radius: 14px; margin: 0;
    font-size: 14px; line-height: 1.5; color: var(--text-primary);
    white-space: pre-wrap;
  }
  .mac-msg--user .mac-msg-text {
    background: linear-gradient(135deg, rgba(255,77,77,0.15), rgba(255,184,77,0.1));
    border: 1px solid rgba(255,77,77,0.2);
    border-radius: 14px 14px 4px 14px;
  }
  .mac-msg--agent .mac-msg-text {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px 14px 14px 4px;
  }

  .mac-typing { color: var(--text-muted); font-style: italic; }

  .mac-input-row {
    display: flex; gap: 8px; padding: 16px;
    border-top: 1px solid var(--border-subtle);
    background: var(--glass-light);
  }
  .mac-input {
    flex: 1; padding: 12px 16px; border-radius: 12px;
    background: var(--bg-primary); border: 1px solid var(--border-subtle);
    color: var(--text-primary); font-size: 14px; font-family: inherit;
    outline: none;
  }
  .mac-input:focus { border-color: var(--accent-primary); }
  .mac-input::placeholder { color: var(--text-muted); }
  .mac-input:disabled { opacity: 0.5; }

  .mac-send {
    padding: 12px 20px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
    color: white; font-size: 14px; font-weight: 700; font-family: inherit;
    cursor: pointer; transition: transform 0.15s;
  }
  .mac-send:active { transform: scale(0.97); }
  .mac-send:disabled { opacity: 0.4; cursor: default; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/brands/MatchAgentChat.svelte
git commit -m "feat: add MatchAgentChat component for brand portal"
```

---

### Task 5: Wire Chat into Brand Portal

**Files:**
- Modify: `src/routes/brands/portal/+page.svelte`

- [ ] **Step 1: Add tab system**

Read the file. Add an import for `MatchAgentChat` and a tab toggle at the top of the portal page:

```typescript
  import MatchAgentChat from '$lib/components/brands/MatchAgentChat.svelte';
  let portalTab: 'search' | 'agent' = 'agent';
```

- [ ] **Step 2: Add tab UI**

Near the top of the template, add tab buttons:

```svelte
<div class="portal-tabs">
  <button class="portal-tab" class:active={portalTab === 'agent'} on:click={() => portalTab = 'agent'}>
    AI Match Agent
  </button>
  <button class="portal-tab" class:active={portalTab === 'search'} on:click={() => portalTab = 'search'}>
    Quick Search
  </button>
</div>
```

- [ ] **Step 3: Wrap existing content in tab conditional**

Wrap the existing search UI in `{#if portalTab === 'search'}...{/if}`. Add the agent chat:

```svelte
{#if portalTab === 'agent'}
  <div class="portal-agent-wrap">
    <MatchAgentChat />
  </div>
{:else}
  <!-- existing search UI -->
{/if}
```

- [ ] **Step 4: Add styles**

```css
  .portal-tabs {
    display: flex; gap: 4px; margin-bottom: 24px;
    background: var(--glass-light); border-radius: 12px; padding: 4px;
    border: 1px solid var(--border-subtle);
  }
  .portal-tab {
    flex: 1; padding: 10px 16px; border-radius: 10px; border: none;
    background: transparent; color: var(--text-muted);
    font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
    transition: all 0.15s;
  }
  .portal-tab.active {
    background: var(--glass-medium); color: var(--text-primary);
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }
  .portal-agent-wrap {
    height: calc(100vh - 200px); min-height: 500px;
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/brands/portal/+page.svelte
git commit -m "feat(brands): add AI Match Agent tab to brand portal"
```

---

### Task 6: Build and Verify

**Files:** None (verification only)

- [ ] **Step 1: Type-check**

```bash
cd /Users/madhviknemani/wagwan-ai && npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "^[0-9]+ (ERROR|COMPLETED)" | tail -10
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Test**

```bash
npm run dev
```

Test:
1. Go to `/brands/portal` — should see "AI Match Agent" and "Quick Search" tabs
2. Agent tab shows chat with opening: "Tell me about what you're trying to sell and who buys it."
3. Type a product description — agent should ask follow-up questions
4. After enough questions, agent should confirm the brief and offer to match
5. Quick Search tab still works as before
