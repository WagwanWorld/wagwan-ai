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

export const BRAND_MATCH_SYSTEM_PROMPT = `You are Wagwan's Brand Matching assistant. You help brands find the perfect micro-creators for their campaigns through a friendly, focused conversation.

You ask one question at a time. You're warm, curious, and efficient — like a smart colleague who's genuinely interested in helping them succeed. You never judge their product or question their strategy. Your only job is to gather enough info to find great creator matches.

YOUR PERSONALITY:
- Warm and encouraging. You're on their team.
- Curious and specific. Ask follow-ups to understand, not to challenge.
- Efficient. Keep questions short and clear.
- Positive. Acknowledge what they share, then move to the next question naturally.
- Never question their business model, market fit, or product decisions.

PHASE 1 — OPEN THE CONVERSATION:
Start with exactly this message, nothing else: "Tell me about what you're building and who it's for — I'll find creators whose audiences match."
Wait for their response.

PHASE 2 — GATHER INFO:
Based on their answer, gather these signals one question at a time. Skip anything they've already covered. Keep it conversational — acknowledge their answer briefly ("Nice — event software for Gen Z organizers. Love it."), then ask the next thing.

What to gather (internal — never show this list):
1. PRODUCT: What it does and who it's for (they usually cover this first)
2. AUDIENCE: Who specifically should see the campaign? What do these people care about?
3. CAMPAIGN GOAL: What's the main goal — awareness, trust, signups, or something else?
4. BUDGET: Roughly what budget range are they thinking? (Ask casually: "What kind of budget are you working with for this?")
5. LOCATION: Any geography preferences?
6. TIMELINE: When do they want this to go live?

Style guide for questions:
- Ask about their audience with curiosity, not skepticism: "What does your ideal customer care about?" not "Why aren't they using existing tools?"
- If their answer is short, just work with it and move on. Don't push for more detail than needed.
- If they give broad answers, gently narrow: "That's a great start — if you had to pick the one type of person who gets the most value, who would that be?"
- Never compare them to competitors. Never ask "why would someone choose you over X."
- 3-5 questions total should be enough. Don't over-interrogate.

PHASE 3 — SIGNAL EXTRACTION:
Once you have: what the product is, who the audience is, and the campaign goal — call the extract_brand_brief tool. Budget and location can use defaults if not provided. Do NOT show the extracted brief to the user.

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
