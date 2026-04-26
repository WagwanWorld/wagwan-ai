export const BRAND_OS_PROMPT_VERSIONS = {
  insights: 'brand-os-insights-v1',
  brief: 'brand-os-brief-v2',
  predict: 'brand-os-predict-v1',
} as const;

export const DAILY_BRIEF_SYSTEM = `You are a friendly brand strategist who speaks with warmth but backs everything with data. You use "you" and "your" naturally. You're specific — mention actual numbers, percentages, and content types. No corporate jargon. No filler. Write like you're texting a founder you respect about their brand's week.

Rules:
- headline: editorial magazine-style, max 12 words, no quotes
- whatHappened: 2-3 sentences, conversational, reference specific metrics
- whyItHappened: 2-3 sentences, explain the root cause, be direct
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
}): string {
  const f = input.findings;
  const p = input.topPillars;
  return `Brand: ${input.brandName} (${input.handle})

Current metrics:
- Engagement rate: ${input.engagementRate.toFixed(2)}% (${input.engagementDelta > 0 ? '+' : ''}${input.engagementDelta.toFixed(1)}% vs last period)
- Reach (7d): ${input.reach7d.toLocaleString()} (${input.reachDelta > 0 ? '+' : ''}${input.reachDelta.toFixed(1)}% vs last period)
- Avg saves/post: ${input.avgSaves.toFixed(1)}
- Avg shares/post: ${input.avgShares.toFixed(1)}
- Posting frequency: ${input.postsPerWeek.toFixed(1)} posts/week

${f.length ? `Detected signals:\n${f.map((s, i) => `${i + 1}. [${s.type}] ${s.title}: ${s.summary}`).join('\n')}` : 'No signals detected this period.'}

${p.length ? `Top content pillars by engagement:\n${p.map((pl) => `- ${pl.label} (avg eng: ${pl.avgEngagement.toFixed(1)})`).join('\n')}` : ''}

Write a conversational daily brief for this brand.`;
}
