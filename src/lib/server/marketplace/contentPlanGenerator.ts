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
  const postHistory = recentPosts.slice(0, 10).map(p =>
    `- [${p.mediaType}] ${p.timestamp} | ${p.likeCount} likes, ${p.commentsCount} comments | "${(p.caption || '').slice(0, 100)}"`
  ).join('\n');

  const insightsSummary = insightsData?.onlineFollowers
    ? `Follower online activity (hourly averages available). Top posting hours from history: ${insightsData.topPostingHours?.join(', ') || 'unknown'}`
    : 'No insights data available — use general best practices for Indian audience.';

  // Build message content with images for vision analysis
  const contentParts: Anthropic.Messages.ContentBlockParam[] = [];

  // Add each image for vision analysis
  for (let i = 0; i < creatives.length; i++) {
    const c = creatives[i];
    if (c.mediaType === 'IMAGE') {
      // Fetch image and convert to base64 for vision
      try {
        const imgRes = await fetch(c.url);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          contentParts.push({
            type: 'text',
            text: `Creative ${i + 1} (${c.fileName}):`,
          });
          contentParts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64,
            },
          });
        } else {
          contentParts.push({
            type: 'text',
            text: `Creative ${i + 1}: ${c.fileName} (${c.mediaType}) — could not load image for analysis`,
          });
        }
      } catch {
        contentParts.push({
          type: 'text',
          text: `Creative ${i + 1}: ${c.fileName} (${c.mediaType}) — could not load image`,
        });
      }
    } else {
      // Video — can't send to vision, describe by filename
      contentParts.push({
        type: 'text',
        text: `Creative ${i + 1}: ${c.fileName} (VIDEO) — analyze based on filename and brand context`,
      });
    }
  }

  // Add the strategy prompt
  contentParts.push({
    type: 'text',
    text: `You are a social media strategist for @${brandProfile.username} (${brandProfile.name}, ${brandProfile.followersCount} followers).

I've shown you the creative images above. Analyze what's IN each image — the text, colors, mood, subject matter — and write captions that directly relate to the visual content.

RECENT POST HISTORY (last 10 posts):
${postHistory || 'No recent posts available.'}

AUDIENCE INSIGHTS:
${insightsSummary}

TASK: Create an optimal posting schedule for these ${creatives.length} creatives. For EACH creative:
1. Write a caption that specifically describes and relates to what's shown in the image. Do NOT write generic captions — reference the actual visual content.
2. Suggest 5-8 relevant hashtags WITHOUT the # symbol (just the word, e.g. "wagwan" not "#wagwan")
3. Pick the best date/time to post (space them out, avoid posting more than 2/day)
4. Explain your reasoning briefly

Respond ONLY with a JSON array:
[
  {
    "creativeIndex": 0,
    "caption": "...",
    "hashtags": ["wagwan", "community", "bangalore"],
    "scheduledAt": "2026-04-18T19:30:00+05:30",
    "mediaType": "IMAGE",
    "reasoning": "..."
  }
]

IMPORTANT:
- Hashtags must NOT include the # symbol
- Captions must directly reference what's visible in the image
- Use IST timezone
- Start scheduling from tomorrow
- Only output the JSON array, no other text.`,
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: contentParts }],
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
    // Strip any # prefix the AI might still include
    hashtags: item.hashtags.map(h => h.replace(/^#+/, '')),
    scheduledAt: item.scheduledAt,
    reasoning: item.reasoning,
  }));
}
