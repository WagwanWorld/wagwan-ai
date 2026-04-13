import { getTokens } from '$lib/server/supabase';
import {
  fetchInstagramProfile,
  fetchInstagramMedia,
  analyseEngagement,
  extractMediaCaptionSignals,
  type InstagramMedia,
} from '$lib/server/instagram';

export interface InstagramInsightsBundle {
  username?: string;
  followersCount?: number;
  mediaCount?: number;
  engagementRateApprox: number;
  avgLikes: number;
  avgComments: number;
  bestPostType: string;
  growthPercent: number | null;
  captionCadence: string;
  topHashtags: string[];
}

function avgCommentsApprox(media: InstagramMedia[]): number {
  const withC = media.filter(m => m.comments_count != null);
  if (!withC.length) return 0;
  const sum = withC.reduce((s, m) => s + (m.comments_count ?? 0), 0);
  return Math.round((sum / withC.length) * 10) / 10;
}

/** Compare recent half vs older half engagement trend as pseudo growth. */
function pseudoGrowthPercent(media: WithEngagement[]): number | null {
  if (media.length < 6) return null;
  const sorted = [...media].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const half = Math.floor(sorted.length / 2);
  const recent = sorted.slice(0, half);
  const older = sorted.slice(half);
  const avg = (items: WithEngagement[]) =>
    items.reduce((s, m) => s + (m.like_count ?? 0) + (m.comments_count ?? 0) * 2, 0) /
    Math.max(items.length, 1);
  const aR = avg(recent);
  const aO = avg(older);
  if (aO < 1) return aR > 0 ? 100 : 0;
  return Math.round(((aR - aO) / aO) * 100);
}

type WithEngagement = InstagramMedia;

function buildInsightsBundle(
  profile: Awaited<ReturnType<typeof fetchInstagramProfile>>,
  media: InstagramMedia[],
): InstagramInsightsBundle {
  const engagement = analyseEngagement(media, profile.followers_count);
  const captions = extractMediaCaptionSignals(media);
  const avgLikes =
    media.filter(m => m.like_count != null).length > 0
      ? Math.round(
          media.reduce((s, m) => s + (m.like_count ?? 0), 0) /
            media.filter(m => m.like_count != null).length,
        )
      : 0;
  const avgComments = avgCommentsApprox(media);

  return {
    username: profile.username,
    followersCount: profile.followers_count,
    mediaCount: profile.media_count,
    engagementRateApprox: Math.round(engagement.avgLikeRate * 10000) / 100,
    avgLikes,
    avgComments,
    bestPostType: engagement.topContentType,
    growthPercent: pseudoGrowthPercent(media),
    captionCadence: captions.igPostingCadence,
    topHashtags: captions.topHashtags.slice(0, 6),
  };
}

/** Reuse already-fetched profile + media (e.g. refresh-signals) to avoid duplicate IG API calls. */
export function computeInstagramInsightsFromMedia(
  profile: Awaited<ReturnType<typeof fetchInstagramProfile>>,
  media: InstagramMedia[],
): InstagramInsightsBundle {
  return buildInsightsBundle(profile, media);
}

export async function computeInstagramInsights(googleSub: string): Promise<InstagramInsightsBundle | null> {
  const tokens = await getTokens(googleSub);
  const igToken = tokens.instagramToken?.trim();
  if (!igToken) return null;

  let profile: Awaited<ReturnType<typeof fetchInstagramProfile>>;
  let media: InstagramMedia[];
  try {
    [profile, media] = await Promise.all([
      fetchInstagramProfile(igToken),
      fetchInstagramMedia(igToken, 30),
    ]);
  } catch (e) {
    console.error('[instagramInsights]', e);
    return null;
  }

  return buildInsightsBundle(profile, media);
}

/** Flat tags for identity_graph / brand overlap. */
export function instagramInsightsToGraphTags(b: InstagramInsightsBundle): string[] {
  const tags = new Set<string>();
  const add = (s: string) => {
    const t = s.trim().toLowerCase().replace(/\s+/g, '_');
    if (t.length > 1) tags.add(t);
  };
  add(b.captionCadence);
  add(`${b.captionCadence}_posting`);
  if (b.bestPostType) add(b.bestPostType.replace(/\s+/g, '_'));
  for (const h of b.topHashtags) add(h);
  if (b.growthPercent != null && b.growthPercent > 15) add('rising_ig_engagement');
  if (b.engagementRateApprox >= 3) add('high_ig_engagement_rate');
  if (b.engagementRateApprox >= 1 && b.engagementRateApprox < 3) add('moderate_ig_engagement_rate');
  add('instagram_signal');
  return [...tags];
}

export async function buildInstagramAgentContext(googleSub: string): Promise<string> {
  const bundle = await computeInstagramInsights(googleSub);
  if (!bundle) {
    return 'Instagram: not connected. Ask the user to link Instagram in Profile.';
  }

  const growth =
    bundle.growthPercent == null ? 'n/a (need more posts)' : `${bundle.growthPercent > 0 ? '+' : ''}${bundle.growthPercent}% vs prior posts`;

  return `Instagram @${bundle.username ?? '?'} (${bundle.followersCount ?? 0} followers, ${bundle.mediaCount ?? 0} media total):
Approx engagement rate (likes/followers avg on sampled media): ${bundle.engagementRateApprox}%
Avg likes (sampled): ${bundle.avgLikes} | Avg comments: ${bundle.avgComments}
Best-performing type in sample: ${bundle.bestPostType}
Engagement trend (recent vs older): ${growth}
Posting cadence: ${bundle.captionCadence}
Top hashtags: ${bundle.topHashtags.join(', ') || '(none)'}`;
}
