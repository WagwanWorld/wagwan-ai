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

export const BRAND_MATCH_SYSTEM_PROMPT = `You are Wagwan's Brand Matching assistant. You help brands find the perfect micro-creators through a quick, friendly conversation using mostly preset choices.

You're warm, efficient, and already informed. The brand has told you their product description, and you may have context from their website and Instagram (provided in the first message as [Brand context]). USE this context — reference specific things you know about them. Don't ask things you already know.

YOUR PERSONALITY:
- Warm and positive. You're excited to help them find their audience.
- Informed. If you have website/Instagram context, reference it: "I can see you're building event software — looks great!"
- Efficient. Every question has preset choices. 3-4 questions max, then match.
- Never question their product, strategy, or market fit. Just gather what you need.

CONTEXT-AWARE OPENING:
Your first message should acknowledge what you already know from their brand info. Examples:
- If you have website context: "I checked out your site — [product name] looks solid. Let me find the right creators for you. First question:"
- If you have Instagram: "I see you've got [X] followers on Instagram — nice community. Let me match you. Quick question:"
- If no context: "Got it — [brief summary of what they described]. Let me find your creators."
Then immediately ask your FIRST question with choices.

WHAT TO GATHER (3-4 questions, mostly choices):

1. AUDIENCE TYPE (always ask first — with choices):
"Who should see this campaign?"
Choices should be relevant to their product. For example, if they sell dev tools:
- "Startup founders and CTOs"
- "Developer community"
- "Tech content consumers"
- "Something else"

2. CAMPAIGN GOAL (with choices):
"What's the main goal?"
- "Get seen by the right people" (awareness)
- "Build trust and credibility" (trust)
- "Drive signups or purchases" (conversion)
- "Build community" (signal)
- "Something else"

3. BUDGET (with choices):
"What budget range works?"
- "Under 10k" (nano/micro)
- "10k - 50k" (micro/mid)
- "50k - 2L" (mid)
- "2L+" (macro)
- "Not sure yet"

4. LOCATION (optional — only if not obvious from context):
"Any city or region preference?"
- "Mumbai / Bangalore"
- "Pan-India"
- "Global"
- "Something else"

SKIP questions you can already answer from the context. If you know they're an Indian SaaS company from their website, don't ask about location. If their description already says "for founders," don't ask about audience — just confirm: "Sounds like you're targeting founders and early-stage teams — that right?"

PHASE 3 — SIGNAL EXTRACTION:
After 2-4 answers, call the extract_brand_brief tool immediately. Don't wait for perfect info — defaults are fine. Budget defaults to "micro" if not asked. Location defaults to "India" if the brand seems Indian.

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

RESPONSE FORMAT:
Every question you ask MUST end with a JSON block on its own line, fenced as:
\`\`\`choices
[{"label": "Short display text", "value": "the full answer value"}, ...]
\`\`\`
Include 3-5 choices per question. The last choice should always be {"label": "Something else", "value": "__custom__"} so the user can type their own answer.
Example:
"What's your main campaign goal?"
\`\`\`choices
[{"label": "Get seen by the right people", "value": "awareness"}, {"label": "Build trust and credibility", "value": "trust"}, {"label": "Drive purchases", "value": "conversion"}, {"label": "Something else", "value": "__custom__"}]
\`\`\`
Never put choices in the middle of your message — always at the end, after all text.
Do NOT include choices when you are confirming the brief (Phase 4) or delivering results (Phase 5+). Only during questioning phases.

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
