import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/server/supabase';

type BrandRow = {
  id: string;
  name: string;
  created_at: string | null;
};

type CampaignRow = {
  brand_id: string | null;
  brand_name: string;
  title: string;
  creative_text: string | null;
  reward_inr: number | null;
  status: string | null;
  created_at: string | null;
};

type PublicBrandProfile = {
  id: string;
  name: string;
  initials: string;
  tags: string[];
  activeCampaigns: number;
  rewardRange: string;
  latestBrief: string;
  matchLine: string;
  palette: string[];
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

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatRewardRange(campaigns: CampaignRow[]): string {
  const rewards = campaigns
    .map((campaign) => Number(campaign.reward_inr ?? 0))
    .filter((reward) => reward > 0);
  if (rewards.length === 0) return 'Brief-led payouts';
  const min = Math.min(...rewards);
  const max = Math.max(...rewards);
  const format = (value: number) =>
    value >= 1000 ? `₹${Math.round(value / 1000)}K` : `₹${value.toLocaleString('en-IN')}`;
  return min === max ? format(min) : `${format(min)}-${format(max)}`;
}

function tagsFor(name: string, campaigns: CampaignRow[]): string[] {
  const haystack = [
    name,
    ...campaigns.flatMap((campaign) => [campaign.title, campaign.creative_text ?? '']),
  ]
    .join(' ')
    .toLowerCase();
  const tags = KEYWORD_TAGS.filter(([keyword]) => haystack.includes(keyword)).map(
    ([, label]) => label,
  );
  if (tags.length > 0) return [...new Set(tags)].slice(0, 3);
  return ['Lifestyle', 'Culture', 'Audience fit'];
}

function matchLineFor(tags: string[], latestBrief: string): string {
  const tagCopy = tags.slice(0, 2).join(' + ');
  return `Best for creators with ${tagCopy || 'strong audience'} signal${latestBrief ? ` around ${latestBrief.toLowerCase()}` : ''}.`;
}

export const GET: RequestHandler = async () => {
  try {
    const sb = getServiceSupabase();
    const [brandsRes, campaignsRes] = await Promise.all([
      sb
        .from('brands')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      sb
        .from('campaigns')
        .select('brand_id, brand_name, title, creative_text, reward_inr, status, created_at')
        .order('created_at', { ascending: false })
        .limit(120),
    ]);

    if (brandsRes.error || campaignsRes.error) {
      console.error(
        '[public brand profiles]',
        brandsRes.error?.message || campaignsRes.error?.message,
      );
      return json({ ok: true, profiles: [], source: 'empty' });
    }

    const brandRows = (brandsRes.data ?? []) as BrandRow[];
    const campaignRows = (campaignsRes.data ?? []) as CampaignRow[];
    const byBrand = new Map<string, CampaignRow[]>();

    for (const campaign of campaignRows) {
      const key = campaign.brand_id || campaign.brand_name.trim().toLowerCase();
      if (!key) continue;
      byBrand.set(key, [...(byBrand.get(key) ?? []), campaign]);
    }

    for (const campaign of campaignRows) {
      const key = campaign.brand_id || campaign.brand_name.trim().toLowerCase();
      if (brandRows.some((brand) => brand.id === campaign.brand_id)) continue;
      if (
        !brandRows.some((brand) => brand.name.toLowerCase() === campaign.brand_name.toLowerCase())
      ) {
        brandRows.push({
          id: key,
          name: campaign.brand_name,
          created_at: campaign.created_at,
        });
      }
    }

    const profiles: PublicBrandProfile[] = brandRows.slice(0, 12).map((brand, index) => {
      const campaigns = byBrand.get(brand.id) ?? byBrand.get(brand.name.toLowerCase()) ?? [];
      const activeCampaigns = campaigns.filter((campaign) =>
        ['active', 'live', 'sent'].includes((campaign.status ?? '').toLowerCase()),
      ).length;
      const latestBrief = campaigns[0]?.title || 'creator campaign';
      const tags = tagsFor(brand.name, campaigns);

      return {
        id: brand.id,
        name: brand.name,
        initials: initialsFor(brand.name),
        tags,
        activeCampaigns,
        rewardRange: formatRewardRange(campaigns),
        latestBrief,
        matchLine: matchLineFor(tags, latestBrief),
        palette: PALETTES[index % PALETTES.length],
      };
    });

    return json({ ok: true, profiles, source: profiles.length > 0 ? 'database' : 'empty' });
  } catch (err) {
    console.error('[public brand profiles]', err);
    return json({ ok: true, profiles: [], source: 'unavailable' });
  }
};
