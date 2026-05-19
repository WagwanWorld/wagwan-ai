import type {
  CreatorInviteAnalysis,
  CreatorInviteFitLabel,
  RosterProfileSnapshot,
} from '$lib/types/creator-invite';
import { computeGraphStrength } from './graphStrength';
import { flattenIdentityGraph } from './identityGraphTags';
import type { ScrapedInstagramProfile } from './instagramScrape';

const HANDLE_RE = /^[a-z0-9._]{2,30}$/;

const THEME_KEYWORDS: Record<string, string[]> = {
  fashion: ['fashion', 'style', 'outfit', 'wear', 'ootd', 'wardrobe'],
  lifestyle: ['lifestyle', 'daily', 'routine', 'life', 'vlog'],
  travel: ['travel', 'trip', 'wander', 'explore', 'destination'],
  fitness: ['fitness', 'workout', 'gym', 'training', 'health'],
  food: ['food', 'recipe', 'cook', 'eat', 'restaurant', 'cafe'],
  beauty: ['beauty', 'makeup', 'skincare', 'glow'],
  tech: ['tech', 'gadget', 'ai', 'startup', 'code'],
};

export function extractWagwanCaptions(wagwan: WagwanCreatorMatch | null): string[] {
  if (!wagwan) return [];
  const ig = wagwan.profile_data?.instagramIdentity as Record<string, unknown> | undefined;
  const snap = ig?.identitySnapshot as { recentPosts?: Array<{ caption?: string }> } | undefined;
  const posts = (snap?.recentPosts ?? ig?.recentPosts ?? []) as Array<{ caption?: string }>;
  const captions: string[] = [];
  for (const p of posts) {
    const c = String(p.caption ?? '').trim();
    if (c.length > 8) captions.push(c.slice(0, 280));
    if (captions.length >= 6) break;
  }
  return captions;
}

export function buildFeedSummary(ctx: { bio: string; captions: string[]; tags: string[] }): {
  feedSummary: string;
  contentThemes: string[];
} {
  const { bio, captions, tags } = ctx;
  const corpus = [bio, ...captions, ...tags].join(' ').toLowerCase();
  const themes: string[] = [];

  for (const [theme, words] of Object.entries(THEME_KEYWORDS)) {
    if (words.some((w) => corpus.includes(w))) themes.push(theme);
  }

  for (const t of tags.slice(0, 4)) {
    const lower = t.toLowerCase();
    if (lower.length > 2 && !themes.includes(lower)) themes.push(lower);
  }

  const uniqueThemes = [...new Set(themes)].slice(0, 4);

  if (captions.length === 0 && !bio) {
    return {
      feedSummary: '',
      contentThemes: uniqueThemes,
    };
  }

  if (captions.length === 0) {
    const themeStr = uniqueThemes.length > 0 ? uniqueThemes.join(', ') : 'general lifestyle';
    return {
      feedSummary: `Bio-led profile with ${themeStr} cues; limited post captions from public HTML.`,
      contentThemes: uniqueThemes,
    };
  }

  const sample = captions[0].slice(0, 80).replace(/\s+/g, ' ');
  const themeStr = uniqueThemes.length > 0 ? uniqueThemes.join(' & ') : 'mixed themes';
  const feedSummary = `Recent posts lean ${themeStr} — e.g. “${sample}${captions[0].length > 80 ? '…' : ''}”.`;

  return { feedSummary, contentThemes: uniqueThemes };
}

export function mergeAnalysisWithFeedInsight(
  analysis: CreatorInviteAnalysis,
  feedSummary: string | undefined,
): CreatorInviteAnalysis {
  if (!feedSummary) return analysis;
  const highlights = [...analysis.highlights];
  if (!highlights.some((h) => h.includes(feedSummary.slice(0, 40)))) {
    highlights.unshift(feedSummary);
  }
  return {
    ...analysis,
    feedInsight: feedSummary,
    highlights: highlights.slice(0, 3),
  };
}

export type WagwanCreatorMatch = {
  google_sub: string;
  name: string;
  profile_data: Record<string, unknown>;
  identity_graph: Record<string, unknown>;
};

export function normalizeIgHandle(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  raw = raw.replace(/^@/, '');
  const urlMatch = raw.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
  if (urlMatch) raw = urlMatch[1];
  const handle = raw.toLowerCase();
  if (!HANDLE_RE.test(handle)) return null;
  return handle;
}

export function parseFollowerCount(raw: string): number | null {
  const s = raw.replace(/,/g, '').trim().toUpperCase();
  if (!s) return null;
  const m = s.match(/^([\d.]+)\s*([KM])?$/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2] === 'K') n *= 1_000;
  if (m[2] === 'M') n *= 1_000_000;
  return Math.round(n);
}

function fitLabelFromScore(score: number | null, limited: boolean): CreatorInviteFitLabel {
  if (limited || score == null) return 'Limited data';
  if (score >= 75) return 'Strong fit';
  if (score >= 55) return 'Good fit';
  return 'Worth exploring';
}

function brandOverlapHighlight(
  creatorTags: string[],
  brandIdentity: Record<string, unknown> | null | undefined,
): string | null {
  if (!brandIdentity || creatorTags.length === 0) return null;
  const pillars = ((brandIdentity.messaging as Record<string, unknown>)?.pillars ??
    brandIdentity.pillars ??
    []) as string[];
  const aesthetic = String(brandIdentity.aesthetic ?? brandIdentity.visualTone ?? '').toLowerCase();
  const pillarStr = pillars.map((p) => String(p).toLowerCase()).join(' ');
  const creatorLower = creatorTags.map((t) => t.toLowerCase());
  const overlap = creatorLower.filter(
    (t) =>
      pillarStr.includes(t) ||
      aesthetic.includes(t) ||
      (t.length > 3 && pillarStr.includes(t.slice(0, 4))),
  );
  if (overlap.length > 0) return 'Content themes overlap with your brand pillars.';
  return null;
}

export function buildSimpleCreatorAnalysisRuleOnly(ctx: {
  scrape: ScrapedInstagramProfile;
  wagwan: WagwanCreatorMatch | null;
  brandIdentity: Record<string, unknown> | null;
}): CreatorInviteAnalysis {
  const { scrape, wagwan, brandIdentity } = ctx;
  const signals: { label: string; value: string }[] = [];

  if (wagwan) {
    const graph = wagwan.identity_graph ?? {};
    const profileData = wagwan.profile_data ?? {};
    const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;
    const snapshot = graph.identitySnapshot as
      | { payload?: { archetype?: string; vibe?: string[] } }
      | undefined;
    const strength = computeGraphStrength(graph, profileData);
    const tags = flattenIdentityGraph(graph).slice(0, 6);
    const engagement = ig?.engagement as Record<string, unknown> | undefined;
    const intel = graph.creatorIntelligence as
      | { brandReadinessScore?: number; growthTrend?: string }
      | undefined;

    const followers = (ig?.followersCount as number) ?? 0;
    if (followers > 0)
      signals.push({ label: 'Followers', value: followers.toLocaleString('en-US') });
    if (snapshot?.payload?.archetype)
      signals.push({ label: 'Archetype', value: snapshot.payload.archetype });
    signals.push({ label: 'Signal', value: strength.label });
    if (engagement?.engagementTier)
      signals.push({ label: 'Engagement', value: String(engagement.engagementTier) });
    if (tags[0]) signals.push({ label: 'Tags', value: tags.slice(0, 2).join(', ') });
    if ((graph.city as string) || (profileData.city as string)) {
      signals.push({ label: 'Location', value: String(graph.city || profileData.city) });
    }
    if (intel?.brandReadinessScore != null) {
      signals.push({ label: 'Readiness', value: `${intel.brandReadinessScore}/100` });
    }

    let fitScore = strength.score;
    if (intel?.brandReadinessScore != null) {
      fitScore = Math.round((fitScore + intel.brandReadinessScore) / 2);
    }
    const overlap = brandOverlapHighlight(tags, brandIdentity);
    const highlights: string[] = [];
    if (overlap) highlights.push(overlap);
    highlights.push(`Wagwan portrait strength: ${strength.label} (${strength.score}/100).`);
    if (intel?.growthTrend) highlights.push(`Growth trend: ${intel.growthTrend}.`);
    if (highlights.length < 2)
      highlights.push(`Active creator profile with @${ig?.username ?? scrape.fullName}.`);

    const summary = `${wagwan.name || scrape.fullName} is on Wagwan with ${strength.label.toLowerCase()} identity depth${
      followers > 0 ? ` and ${followers.toLocaleString('en-US')} followers` : ''
    }.`;

    return {
      dataSource: 'wagwan',
      summary,
      highlights: highlights.slice(0, 3),
      fitLabel: fitLabelFromScore(fitScore, false),
      fitScore,
      signals: signals.slice(0, 6),
    };
  }

  const followers = parseFollowerCount(scrape.followers);
  if (scrape.followers) signals.push({ label: 'Followers', value: scrape.followers });
  if (scrape.posts) signals.push({ label: 'Posts', value: scrape.posts });
  signals.push({ label: 'Verified', value: scrape.isVerified ? 'Yes' : 'No' });
  if (scrape.bio)
    signals.push({
      label: 'Bio',
      value: scrape.bio.slice(0, 60) + (scrape.bio.length > 60 ? '…' : ''),
    });

  let fitScore: number | null = null;
  const limited = !scrape.followers && !scrape.bio;
  if (!limited) {
    fitScore = 40;
    if (followers != null) {
      if (followers >= 5_000 && followers <= 150_000) fitScore += 25;
      else if (followers >= 1_000) fitScore += 15;
    }
    if (scrape.bio.length > 20) fitScore += 15;
    if (scrape.isVerified) fitScore += 10;
    fitScore = Math.min(85, fitScore);
  }

  const highlights: string[] = [];
  if (scrape.bio) highlights.push(scrape.bio.slice(0, 120));
  else highlights.push('Public profile found; limited bio data from Instagram.');
  highlights.push('Not on Wagwan yet — invite them to connect their Instagram on the platform.');
  if (scrape.isVerified) highlights.push('Verified account on Instagram.');

  const summary = limited
    ? `@${scrape.fullName} has a public Instagram presence but we only have thin profile data.`
    : `${scrape.fullName} looks like a ${scrape.followers || 'mid-tier'} creator based on their public Instagram profile.`;

  return {
    dataSource: 'public_scrape',
    summary,
    highlights: highlights.slice(0, 3),
    fitLabel: fitLabelFromScore(fitScore, limited),
    fitScore,
    signals: signals.slice(0, 6),
  };
}

export function buildRosterProfileSnapshot(ctx: {
  scrape: ScrapedInstagramProfile;
  wagwan: WagwanCreatorMatch | null;
  handle: string;
}): RosterProfileSnapshot {
  const { scrape, wagwan, handle } = ctx;
  const scrapedAt = new Date().toISOString();
  const followersCount = parseFollowerCount(scrape.followers);
  const wagwanCaptions = extractWagwanCaptions(wagwan);
  const captions = wagwanCaptions.length > 0 ? wagwanCaptions : (scrape.recentCaptions ?? []);
  const tags = wagwan ? flattenIdentityGraph(wagwan.identity_graph ?? {}).slice(0, 8) : [];
  const { feedSummary } = buildFeedSummary({
    bio: scrape.bio,
    captions,
    tags,
  });

  if (!wagwan) {
    return {
      handle,
      displayName: scrape.fullName,
      bio: scrape.bio,
      profilePicture: scrape.profilePictureUrl,
      followers: scrape.followers,
      followersCount,
      following: scrape.following,
      posts: scrape.posts,
      isVerified: scrape.isVerified,
      onPlatform: false,
      feedSummary: feedSummary || undefined,
      recentCaptions: captions.length > 0 ? captions : undefined,
      scrapedAt,
    };
  }

  const graph = wagwan.identity_graph ?? {};
  const profileData = wagwan.profile_data ?? {};
  const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;
  const snapshot = graph.identitySnapshot as
    | { payload?: { archetype?: string; vibe?: string[] } }
    | undefined;
  const strength = computeGraphStrength(graph, profileData);
  const visual = ig?.visual as Record<string, unknown> | undefined;
  const engagement = ig?.engagement as Record<string, unknown> | undefined;
  const igFollowers = (ig?.followersCount as number) ?? 0;

  const bioFromIg = String(ig?.rawSummary ?? scrape.bio ?? '').slice(0, 200);

  return {
    handle,
    displayName: wagwan.name || scrape.fullName,
    bio: bioFromIg,
    profilePicture: (ig?.profilePicture as string) || undefined,
    followers: igFollowers > 0 ? igFollowers.toLocaleString('en-US') : scrape.followers,
    followersCount: igFollowers > 0 ? igFollowers : followersCount,
    following: scrape.following,
    posts: scrape.posts,
    isVerified: scrape.isVerified,
    onPlatform: true,
    archetype: snapshot?.payload?.archetype || undefined,
    location: String(graph.city || profileData.city || '') || undefined,
    strengthScore: strength.score,
    strengthLabel: strength.label,
    engagementTier: (engagement?.engagementTier as string) || undefined,
    vibeTags: (snapshot?.payload?.vibe ?? []).slice(0, 4),
    contentTags: tags.slice(0, 6),
    colorPalette: ((visual?.colorPalette || []) as string[]).slice(0, 4),
    aesthetic: String(graph.aesthetic || ig?.aesthetic || '') || undefined,
    lifestyle: String(graph.lifestyle || ig?.lifestyle || '') || undefined,
    feedSummary: feedSummary || undefined,
    recentCaptions: captions.length > 0 ? captions : undefined,
    scrapedAt,
  };
}

/** Minimal scrape object for on-platform creators when HTML scrape is skipped or fails. */
export function scrapeFromWagwanMatch(
  wagwan: WagwanCreatorMatch,
  handle: string,
): ScrapedInstagramProfile {
  const ig = wagwan.profile_data?.instagramIdentity as Record<string, unknown> | undefined;
  const followers = (ig?.followersCount as number) ?? 0;
  const mediaCount = (ig?.mediaCount as number) ?? 0;
  return {
    bio: String(ig?.rawSummary ?? ''),
    followers: followers > 0 ? followers.toLocaleString('en-US') : '',
    following: '',
    posts: mediaCount > 0 ? String(mediaCount) : '',
    fullName: wagwan.name || handle,
    isVerified: Boolean(ig?.isVerified),
    profilePictureUrl: (ig?.profilePicture as string) || undefined,
    recentCaptions: extractWagwanCaptions(wagwan),
  };
}

export function fallbackInviteMessage(
  brandName: string,
  creatorName: string,
  onboardingUrl: string,
): string {
  return `Hi ${creatorName.split(' ')[0] || creatorName},

${brandName} is building a creator roster on Wagwan and would like you onboard. Wagwan helps creators connect with brands that fit their audience — you keep your voice, we handle the match quality.

If you're open to it, join here (takes a few minutes to connect Instagram):
${onboardingUrl}

— ${brandName}`;
}
