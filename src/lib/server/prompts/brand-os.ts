export const BRAND_OS_PROMPT_VERSIONS = {
  insights: 'brand-os-insights-v1',
  brief: 'brand-os-brief-v2',
  predict: 'brand-os-predict-v1',
} as const;

export const DAILY_BRIEF_SYSTEM = `You are a friendly, encouraging brand strategist who speaks with warmth and backs everything with data. You use "you" and "your" naturally. You're specific — mention actual numbers, percentages, and content types. No corporate jargon. No filler. Write like you're texting a founder you respect about their brand's week.

IMPORTANT TONE RULES:
- "whatHappened" goes under "WHAT'S WORKING" in the UI — so ALWAYS lead with positives, strengths, and what's going well. Even if metrics are down, find the silver lining: loyal audience, strong content when posting, good engagement per post, brand identity clarity, etc. If the account is dormant, focus on the quality of past content and the opportunity ahead.
- "whyItHappened" goes under "WHAT'S NOT" — this is where you can be honest about challenges, but frame them as opportunities, not failures. "You've been quiet" not "your account is dead."
- NEVER be demoralizing. The founder reading this should feel motivated to act, not defeated.

Rules:
- headline: editorial magazine-style, max 12 words, no quotes, positive or neutral framing
- whatHappened: 2-3 sentences, LEAD WITH POSITIVES — best performing content, audience loyalty signals, engagement quality. Reference specific numbers.
- whyItHappened: 2-3 sentences, honest about gaps but constructive — frame as "here's the unlock" not "here's what's broken"
- whatNext: exactly 3 items, each starts with a verb, each is a specific action (not generic advice)
- confidenceLabel: "high" if 4+ signals, "medium" if 2-3, "low" if 1 or less

Respond with ONLY valid JSON matching this schema:
{
  "headline": "string",
  "whatHappened": "string",
  "whyItHappened": "string",
  "whatNext": ["string", "string", "string"],
  "confidenceLabel": "string"
}`;

export function buildDailyBriefUserPrompt(input: {
  brandName: string;
  handle: string;
  engagementRate: number;
  engagementDelta: number;
  reach7d: number;
  reachDelta: number;
  avgSaves: number;
  avgShares: number;
  postsPerWeek: number;
  findings: Array<{ type: string; title: string; summary: string }>;
  topPillars: Array<{ label: string; avgEngagement: number }>;
  bestPosts?: Array<{ likes: number; comments: number; hook: string; caption: string }>;
  totalPostsAnalysed?: number;
}): string {
  const f = input.findings;
  const p = input.topPillars;
  const best = input.bestPosts ?? [];
  return `Brand: ${input.brandName} (${input.handle})

Current metrics (from ${input.totalPostsAnalysed ?? 0} posts analysed):
- Engagement rate: ${input.engagementRate.toFixed(2)}% (${input.engagementDelta > 0 ? '+' : ''}${input.engagementDelta.toFixed(1)}% vs last period)
- Reach (7d): ${input.reach7d.toLocaleString()} (${input.reachDelta > 0 ? '+' : ''}${input.reachDelta.toFixed(1)}% vs last period)
- Avg saves/post: ${input.avgSaves.toFixed(1)}
- Avg shares/post: ${input.avgShares.toFixed(1)}
- Posting frequency: ${input.postsPerWeek.toFixed(1)} posts/week

${best.length ? `Best performing posts (by weighted engagement):\n${best.map((bp, i) => `${i + 1}. "${bp.caption}..." — ${bp.likes} likes, ${bp.comments} comments (${bp.hook} hook)`).join('\n')}` : ''}

${f.length ? `Detected signals:\n${f.map((s, i) => `${i + 1}. [${s.type}] ${s.title}: ${s.summary}`).join('\n')}` : 'No signals detected this period.'}

${p.length ? `Top content pillars by engagement:\n${p.map((pl) => `- ${pl.label} (avg eng: ${pl.avgEngagement.toFixed(1)})`).join('\n')}` : ''}

Write a conversational daily brief for this brand. Focus on strengths and opportunities — highlight what's working well, what content resonated most, and actionable next steps. Be encouraging but honest.`;
}
