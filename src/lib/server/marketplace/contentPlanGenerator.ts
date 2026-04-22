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
  brandIdentity?: Record<string, unknown> | null,
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

${brandIdentity ? `BRAND IDENTITY (extracted from their Instagram):
- Aesthetic: ${(brandIdentity as any).aesthetic || 'unknown'}
- Food vibe: ${(brandIdentity as any).foodVibe || 'n/a'}
- Lifestyle: ${(brandIdentity as any).lifestyle || 'n/a'}
- Interests: ${JSON.stringify((brandIdentity as any).interests || [])}
- Caption style: ${(brandIdentity as any).captionStyle || 'unknown'}
- Personality: ${JSON.stringify((brandIdentity as any).personality || {})}
- Visual identity: ${JSON.stringify((brandIdentity as any).visual?.palette || (brandIdentity as any).visual?.mood || 'unknown')}
- Engagement tier: ${(brandIdentity as any).igCreatorTier || 'unknown'}
- Bio: ${(brandIdentity as any).bio || ''}

USE THIS BRAND IDENTITY to match the tone, voice, and style of captions. The caption should feel like it was written by the brand's own social media manager — same energy, same language patterns, same emoji usage.
` : ''}
Look at each image to understand the vibe and theme, then write a short caption that fits.

RECENT POST HISTORY (last 10 posts):
${postHistory || 'No recent posts available.'}

AUDIENCE INSIGHTS:
${insightsSummary}

RULES FOR CAPTIONS:
- Keep it SHORT. 1-2 lines max. No essays.
- Match the energy of the image but don't describe it literally. Don't say "this image shows..." or reference colors/text in the image.
- Write like a brand social media manager — punchy, casual, confident.
- Minimal emojis (0-2 max). No emoji spam.
- End with a subtle CTA or question if it fits naturally. Skip it if it doesn't.

IMPORTANT — TODAY'S DATE AND TIME IS: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} IST.
All scheduled times MUST be in the FUTURE — at least 2 hours from now. Never schedule in the past.

TASK: For each creative, provide:
1. A short, punchy caption (1-2 lines)
2. 5-7 hashtags WITHOUT the # symbol (e.g. "wagwan" not "#wagwan")
3. Best date/time to post (MUST be in the future, starting from today or tomorrow)
4. Brief reasoning for the chosen time

JSON array only:
[
  {
    "creativeIndex": 0,
    "caption": "...",
    "hashtags": ["wagwan", "community", "bangalore"],
    "scheduledAt": "YYYY-MM-DDTHH:mm:ss+05:30",
    "mediaType": "IMAGE",
    "reasoning": "..."
  }
]

Use IST timezone (+05:30). Schedule across the coming days — space posts out, don't bunch them. Only output JSON.`,
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

  const now = Date.now();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  return items.map((item, idx) => {
    let scheduledAt = item.scheduledAt;

    // Safety: if the scheduled time is in the past, bump to future
    const scheduled = new Date(scheduledAt).getTime();
    if (isNaN(scheduled) || scheduled < now + twoHoursMs) {
      // Schedule for tomorrow at a reasonable hour, spaced by index
      const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
      tomorrow.setHours(10 + idx * 3, 0, 0, 0); // 10am, 1pm, 4pm, 7pm...
      scheduledAt = tomorrow.toISOString();
    }

    return {
      gcsUrl: creatives[item.creativeIndex]?.url || '',
      mediaType: (item.mediaType || creatives[item.creativeIndex]?.mediaType || 'IMAGE') as ContentPlanItem['mediaType'],
      caption: item.caption,
      hashtags: item.hashtags.map(h => h.replace(/^#+/, '')),
      scheduledAt,
      reasoning: item.reasoning,
    };
  });
}
