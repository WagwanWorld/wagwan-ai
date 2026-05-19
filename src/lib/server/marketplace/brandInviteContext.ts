import type { SupabaseClient } from '@supabase/supabase-js';
import type { BrandCampaignPreview, BrandInviteContext } from '$lib/types/brand-invite';

export type CampaignRow = {
  brand_id: string | null;
  brand_name: string;
  title: string;
  creative_text: string | null;
  reward_inr: number | null;
  status: string | null;
  created_at: string | null;
};

const PALETTES = [
  ['#f97316', '#ec4899', '#8b5cf6'],
  ['#84cc16', '#22c55e', '#06b6d4'],
  ['#facc15', '#fb7185', '#ef4444'],
  ['#38bdf8', '#6366f1', '#a855f7'],
  ['#f59e0b', '#14b8a6', '#0f172a'],
];

const KEYWORD_TAGS: Array<[string, string]> = [
  ['saas', 'SaaS'],
  ['founder', 'Founders'],
  ['fitness', 'Fitness'],
  ['food', 'Food'],
  ['beauty', 'Beauty'],
  ['fashion', 'Fashion'],
  ['music', 'Music'],
  ['finance', 'Finance'],
  ['startup', 'Startups'],
  ['wellness', 'Wellness'],
  ['travel', 'Travel'],
  ['creator', 'Creators'],
  ['college', 'Campus'],
  ['developer', 'Developers'],
];

export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatRewardRange(campaigns: CampaignRow[]): string {
  const rewards = campaigns
    .map((campaign) => Number(campaign.reward_inr ?? 0))
    .filter((reward) => reward > 0);
  if (rewards.length === 0) return 'Brief-led payouts';
  const min = Math.min(...rewards);
  const max = Math.max(...rewards);
  const format = (value: number) =>
    value >= 1000 ? `₹${Math.round(value / 1000)}K` : `₹${value.toLocaleString('en-IN')}`;
  return min === max ? format(min) : `${format(min)}–${format(max)}`;
}

export function tagsFor(
  name: string,
  campaigns: CampaignRow[],
  identity?: Record<string, unknown>,
): string {
  const identityTags = [
    String(identity?.category ?? ''),
    String(identity?.industry ?? ''),
    String(identity?.aesthetic ?? ''),
    ...(((identity?.messaging as Record<string, unknown>)?.pillars ?? []) as string[]),
  ];
  const haystack = [
    name,
    ...identityTags,
    ...campaigns.flatMap((campaign) => [campaign.title, campaign.creative_text ?? '']),
  ]
    .join(' ')
    .toLowerCase();
  const tags = KEYWORD_TAGS.filter(([keyword]) => haystack.includes(keyword)).map(
    ([, label]) => label,
  );
  if (tags.length > 0) return [...new Set(tags)].slice(0, 4);
  return ['Lifestyle', 'Culture', 'Audience fit'];
}

export function matchLineFor(tags: string[], latestBrief: string): string {
  const tagCopy = tags.slice(0, 2).join(' + ');
  return `Best for creators with ${tagCopy || 'strong audience'} signal${latestBrief ? ` around ${latestBrief.toLowerCase()}` : ''}.`;
}

export function paletteForBrand(brandId: string, identity?: Record<string, unknown>): string[] {
  const fromIdentity = (identity?.colorPalette ?? identity?.palette) as string[] | undefined;
  if (Array.isArray(fromIdentity) && fromIdentity.length > 0) {
    return fromIdentity.slice(0, 4);
  }
  let h = 0;
  for (let i = 0; i < brandId.length; i++) h = (Math.imul(31, h) + brandId.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

function excerpt(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + '…';
}

function brandPitchFromIdentity(
  identity: Record<string, unknown>,
  matchLine: string,
  latestBrief: string,
): string {
  const bio = String(
    identity.bio ?? identity.summary ?? identity.description ?? identity.elevatorPitch ?? '',
  ).trim();
  if (bio) return excerpt(bio, 160);
  const aesthetic = String(identity.aesthetic ?? identity.visualTone ?? '').trim();
  const lifestyle = String(identity.lifestyle ?? '').trim();
  if (aesthetic && lifestyle) return excerpt(`${aesthetic} · ${lifestyle}`, 160);
  if (aesthetic) return excerpt(aesthetic, 160);
  if (matchLine) return excerpt(matchLine, 160);
  if (latestBrief) return `Building creator campaigns around ${latestBrief}.`;
  return '';
}

export async function buildBrandInviteContext(
  sb: SupabaseClient,
  brandId: string,
  opts?: { inviteId?: string; fallbackName?: string },
): Promise<BrandInviteContext | null> {
  const { inviteId, fallbackName } = opts ?? {};

  const { data: brandRow } = await sb
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .maybeSingle();
  if (!brandRow?.id) return null;

  const { data: accountRows } = await sb
    .from('brand_accounts')
    .select('ig_username, ig_name, ig_profile_picture, ig_followers_count, brand_identity')
    .eq('brand_id', brandId)
    .limit(1);

  const account = accountRows?.[0] as
    | {
        ig_username: string;
        ig_name: string | null;
        ig_profile_picture: string | null;
        ig_followers_count: number | null;
        brand_identity: Record<string, unknown> | null;
      }
    | undefined;

  const identity = (account?.brand_identity ?? {}) as Record<string, unknown>;
  const name = account?.ig_name?.trim() || fallbackName?.trim() || String(brandRow.name ?? 'Brand');
  const handle = account?.ig_username?.replace(/^@/, '') ?? '';

  const { data: campaignRows } = await sb
    .from('campaigns')
    .select('brand_id, brand_name, title, creative_text, reward_inr, status, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(12);

  const campaigns = (campaignRows ?? []) as CampaignRow[];
  const activeStatuses = new Set(['active', 'live', 'sent']);
  const activeCampaigns = campaigns.filter((c) =>
    activeStatuses.has((c.status ?? '').toLowerCase()),
  );
  const latestBrief = campaigns[0]?.title || activeCampaigns[0]?.title || 'creator campaigns';
  const tags = tagsFor(name, campaigns, identity);

  const campaignPreviews: BrandCampaignPreview[] = activeCampaigns.slice(0, 3).map((c) => ({
    title: c.title,
    creativeText: excerpt(c.creative_text ?? '', 160),
    rewardInr: c.reward_inr,
    status: c.status ?? '',
  }));

  const bio =
    String(identity.bio ?? identity.summary ?? identity.description ?? '').trim() ||
    String(identity.elevatorPitch ?? '').trim();

  const brandPitch = brandPitchFromIdentity(identity, matchLineFor(tags, latestBrief), latestBrief);

  return {
    brandId,
    name,
    initials: initialsFor(name),
    handle,
    profilePicture: account?.ig_profile_picture ?? '',
    followers: account?.ig_followers_count ?? 0,
    bio,
    aesthetic: String(identity.aesthetic ?? identity.visualTone ?? '').trim(),
    lifestyle: String(identity.lifestyle ?? '').trim(),
    tags,
    colorPalette: paletteForBrand(brandId, identity),
    activeCampaignCount: activeCampaigns.length,
    campaigns: campaignPreviews,
    latestBrief,
    rewardRange: formatRewardRange(campaigns),
    matchLine: matchLineFor(tags, latestBrief),
    brandPitch,
    inviteLine: brandPitch,
    instagramUrl: handle ? `https://www.instagram.com/${encodeURIComponent(handle)}/` : '',
    profileUrl: `/brand/${brandId}`,
  };
}
