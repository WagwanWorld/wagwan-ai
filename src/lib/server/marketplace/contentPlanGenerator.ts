import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY || '' });

export interface ContentPlanItem {
  gcsUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES';
  caption: string;
  hashtags: string[];
  scheduledAt: string;
  reasoning: string;
}

export async function generateContentPlan(
  creatives: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO'; fileName: string }>,
  brandProfile: { username: string; name: string; followersCount: number },
  recentPosts: Array<{ caption: string; timestamp: string; likeCount: number; commentsCount: number; mediaType: string }>,
  insightsData: { onlineFollowers?: Record<string, number[]>; topPostingHours?: number[] } | null,
): Promise<ContentPlanItem[]> {
  const creativeSummary = creatives.map((c, i) => `Creative ${i + 1}: ${c.fileName} (${c.mediaType})`).join('\n');

  const postHistory = recentPosts.slice(0, 10).map(p =>
    `- [${p.mediaType}] ${p.timestamp} | ${p.likeCount} likes, ${p.commentsCount} comments | "${(p.caption || '').slice(0, 100)}"`
  ).join('\n');

  const insightsSummary = insightsData?.onlineFollowers
    ? `Follower online activity (hourly averages available). Top posting hours from history: ${insightsData.topPostingHours?.join(', ') || 'unknown'}`
    : 'No insights data available — use general best practices for Indian audience.';

  const prompt = `You are a social media strategist for @${brandProfile.username} (${brandProfile.name}, ${brandProfile.followersCount} followers).

CREATIVES TO SCHEDULE:
${creativeSummary}

RECENT POST HISTORY (last 10 posts):
${postHistory}

AUDIENCE INSIGHTS:
${insightsSummary}

TASK: Create an optimal posting schedule for these ${creatives.length} creatives. For each:
1. Write a caption matching the brand's voice (analyze their recent captions for tone, emoji usage, CTA style)
2. Suggest 5-8 relevant hashtags (mix of broad + niche)
3. Pick the best date/time to post (space them out, avoid posting more than 2/day)
4. Explain your reasoning briefly

Respond in JSON array format:
[
  {
    "creativeIndex": 0,
    "caption": "...",
    "hashtags": ["tag1", "tag2"],
    "scheduledAt": "2026-04-18T19:30:00+05:30",
    "mediaType": "IMAGE",
    "reasoning": "..."
  }
]

Use IST timezone. Start scheduling from tomorrow. Only output the JSON array, no other text.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON');

  const items = JSON.parse(jsonMatch[0]) as Array<{
    creativeIndex: number;
    caption: string;
    hashtags: string[];
    scheduledAt: string;
    mediaType: string;
    reasoning: string;
  }>;

  return items.map(item => ({
    gcsUrl: creatives[item.creativeIndex]?.url || '',
    mediaType: (item.mediaType || creatives[item.creativeIndex]?.mediaType || 'IMAGE') as ContentPlanItem['mediaType'],
    caption: item.caption,
    hashtags: item.hashtags,
    scheduledAt: item.scheduledAt,
    reasoning: item.reasoning,
  }));
}
