# Brand Matching Agent

**Date:** 2026-04-14
**Goal:** Build an AI-powered conversational brand matching agent that interviews brands, builds a structured brief, scores creators from the Wagwan network, and delivers a ranked shortlist with outreach briefs.

---

## 1. Overview

The brand matching agent replaces the current "search by keywords" approach with an audience-first conversational flow. A brand rep chats with the agent, which asks intelligent questions one at a time, extracts a structured `BRAND_BRIEF`, scores every creator portrait against it, and presents a ranked shortlist with specific reasoning.

The agent is the full prompt provided by the founder (attached as the system prompt). It follows 7 phases: open → question → extract → confirm → match → shortlist → outreach brief.

---

## 2. API Endpoint

### `POST /api/brand/match-agent`

**Request body:**
```json
{
  "message": "string — brand rep's message",
  "threadId": "string — conversation ID for continuity",
  "history": [
    { "role": "user" | "agent", "text": "..." }
  ]
}
```

**Response:** Server-Sent Events (SSE) stream, same pattern as `/api/chat`:
- `event: text_delta` — streaming text from the agent
- `event: message` — complete message
- `event: brief` — extracted BRAND_BRIEF (sent when Phase 3 completes)
- `event: matches` — creator shortlist with scores (sent when Phase 5 completes)
- `event: outreach` — generated outreach brief for a specific creator
- `event: error` — error message

### Thread Persistence

Conversations stored in the existing `threads` + `messages` Supabase tables (already exist from multi-agent chats). Thread type: `brand_match`.

---

## 3. System Prompt

The full brand matching agent prompt (provided by the founder) is stored as a constant in the server module. It covers:

- Phase 1: Open with "Tell me about what you're trying to sell and who buys it."
- Phase 2: Intelligent probing across 5 signal areas (product clarity, buyer identity, campaign intent, hard constraints, success definition)
- Phase 3: Internal BRAND_BRIEF extraction
- Phase 4: Confirm back to brand before matching
- Phase 5: Score creators using weighted formula
- Phase 6: Conversational shortlist delivery
- Phase 7: Outreach brief generation

---

## 4. BRAND_BRIEF Schema

Extracted by Claude from the conversation. Structured as:

```typescript
interface BrandBrief {
  product_summary: string;
  buyer_roles: string[];
  buyer_stage: string[];           // seed, growth, enterprise, etc.
  buyer_identity_signals: string[]; // what they care about, aspire to
  bad_fit_signals: string[];        // explicit disqualifiers
  campaign_intent: 'awareness' | 'trust' | 'conversion' | 'signal';
  content_themes_needed: string[];  // topics creator must speak to
  budget_tier: 'nano' | 'micro' | 'mid' | 'macro';
  timeline: string;
  geography: string[];
  success_metric: string;
  brand_voice_match: string;        // tone/energy that fits
}
```

Claude extracts this via a tool_use call (`extract_brand_brief` tool) during Phase 3. The agent decides when it has enough signal.

---

## 5. Creator Scoring Engine

### Input: Creator Portrait

Each creator in the network has a portrait derived from their identity graph:

```typescript
interface CreatorPortrait {
  google_sub: string;
  name: string;
  handle: string;               // Instagram username
  follower_count: number;
  builder_score: number;         // 0-100, from inference
  creator_score: number;         // 0-100, from inference
  momentum_score: number;        // 0-100, from inference
  content_themes: string[];      // top topics from identity graph
  engagement_tier: string;       // from Instagram signals
  posting_cadence: string;       // from Instagram signals
  location: string;
  archetype: string;             // from identity snapshot
  ig_creator_tier: string;       // nano/micro/mid/macro
  rates: CreatorRates | null;    // from creator_rates table
  graph_strength: number;        // portrait integrity score
  past_brand_categories: string[]; // from campaign_interactions
}
```

Built at match time from `user_profiles` + `identity_graph` + `creator_rates` + `campaign_interactions`.

### Scoring Formula

```
MATCH_SCORE = (
  credibility           × 0.30 +
  audience_composition  × 0.35 +
  engagement_quality    × 0.20 +
  momentum              × 0.15
)
```

**Credibility** (0-1): Jaccard overlap between `content_themes_needed` and creator's `content_themes` + identity graph tags. Enhanced by checking if the creator's domain narratives reference the needed topics.

**Audience Composition** (0-1): How well the creator's follower profile matches the `buyer_identity_signals`. For Business/Creator accounts with demographics: direct demographic match. For others: inferred from creator's content themes + engagement patterns + archetype alignment with buyer identity.

**Engagement Quality** (0-1): Composite of `engagement_tier`, posting cadence, and `graph_strength` as a proxy for engagement authenticity.

**Momentum** (0-1): `momentum_score / 100` from inference pipeline.

### Disqualification Rules

Hard filters applied before scoring:
- Posting cadence < 1/week (audience is cold)
- Graph strength < 30 (not enough portrait data)
- Follower count outside budget tier range:
  - nano: 500-5k
  - micro: 5k-25k
  - mid: 25k-100k
  - macro: 100k+
- Creator not marked `available` in creator_rates
- Past brand categories include a direct competitor (if specified in bad_fit_signals)

### Output

Top creators sorted by MATCH_SCORE. Each result includes:
- Creator portrait summary
- Match score (0-100)
- Match reasoning (which signals drove the score)
- One risk/watch-out per creator
- Disqualification stats (X creators cut, most common reason)

---

## 6. Tool Definitions for Claude

The agent uses 3 tools:

### `extract_brand_brief`
Called during Phase 3 when Claude has enough signal.
```json
{
  "name": "extract_brand_brief",
  "description": "Extract the structured brand brief from the conversation so far.",
  "input_schema": {
    "type": "object",
    "properties": {
      "product_summary": { "type": "string" },
      "buyer_roles": { "type": "array", "items": { "type": "string" } },
      "buyer_stage": { "type": "array", "items": { "type": "string" } },
      "buyer_identity_signals": { "type": "array", "items": { "type": "string" } },
      "bad_fit_signals": { "type": "array", "items": { "type": "string" } },
      "campaign_intent": { "type": "string", "enum": ["awareness", "trust", "conversion", "signal"] },
      "content_themes_needed": { "type": "array", "items": { "type": "string" } },
      "budget_tier": { "type": "string", "enum": ["nano", "micro", "mid", "macro"] },
      "timeline": { "type": "string" },
      "geography": { "type": "array", "items": { "type": "string" } },
      "success_metric": { "type": "string" },
      "brand_voice_match": { "type": "string" }
    },
    "required": ["product_summary", "buyer_roles", "buyer_identity_signals", "campaign_intent", "content_themes_needed", "budget_tier"]
  }
}
```

### `run_creator_match`
Called during Phase 5 after brief is confirmed.
```json
{
  "name": "run_creator_match",
  "description": "Score all creators against the brand brief and return the shortlist.",
  "input_schema": {
    "type": "object",
    "properties": {
      "brief": { "type": "object", "description": "The confirmed BRAND_BRIEF" },
      "limit": { "type": "number", "description": "Max creators to return (default 5)" }
    },
    "required": ["brief"]
  }
}
```

### `generate_outreach_brief`
Called during Phase 7 when brand requests outreach for a specific creator.
```json
{
  "name": "generate_outreach_brief",
  "description": "Generate a 120-160 word outreach brief for a specific creator.",
  "input_schema": {
    "type": "object",
    "properties": {
      "creator_name": { "type": "string" },
      "creator_handle": { "type": "string" },
      "match_reasoning": { "type": "string" },
      "brand_brief_summary": { "type": "string" }
    },
    "required": ["creator_name", "brand_brief_summary"]
  }
}
```

---

## 7. Files

| Action | File | What |
|--------|------|------|
| Create | `src/lib/server/marketplace/brandMatchAgent.ts` | System prompt constant + tool definitions |
| Create | `src/lib/server/marketplace/creatorScoring.ts` | Scoring engine: load portraits, score, disqualify, rank |
| Create | `src/lib/server/marketplace/buildCreatorPortrait.ts` | Build CreatorPortrait from user_profiles + identity_graph |
| Create | `src/routes/api/brand/match-agent/+server.ts` | SSE streaming endpoint with tool execution |
| Modify | `src/routes/brands/portal/+page.svelte` | Add chat interface alongside existing search |

---

## 8. Model Selection

- Agent conversation: `claude-haiku-4-5` (fast, cheap — it's a conversation, not deep analysis)
- Brief extraction: handled by same haiku call via tool_use
- Creator scoring: deterministic code, no LLM
- Outreach brief generation: `claude-haiku-4-5` (short text generation)

Estimated cost per brand conversation: ~$0.02-0.05 (3-8 turns of conversation + tool calls).
