import { describe, it, expect } from 'vitest';
import {
  initialsFor,
  formatRewardRange,
  tagsFor,
  matchLineFor,
  paletteForBrand,
  type CampaignRow,
} from '../src/lib/server/marketplace/brandInviteContext';

describe('initialsFor', () => {
  it('returns up to two initials', () => {
    expect(initialsFor('Acme Labs')).toBe('AL');
    expect(initialsFor('Wagwan')).toBe('W');
  });
});

describe('formatRewardRange', () => {
  it('formats single and range rewards', () => {
    const campaigns: CampaignRow[] = [
      {
        brand_id: 'b',
        brand_name: 'X',
        title: 'A',
        creative_text: null,
        reward_inr: 5000,
        status: 'active',
        created_at: null,
      },
      {
        brand_id: 'b',
        brand_name: 'X',
        title: 'B',
        creative_text: null,
        reward_inr: 15000,
        status: 'active',
        created_at: null,
      },
    ];
    expect(formatRewardRange(campaigns)).toBe('₹5K–₹15K');
    expect(formatRewardRange([])).toBe('Brief-led payouts');
  });
});

describe('tagsFor', () => {
  it('extracts keyword tags from campaigns and identity', () => {
    const campaigns: CampaignRow[] = [
      {
        brand_id: 'b',
        brand_name: 'FitCo',
        title: 'Fitness launch',
        creative_text: 'Workout reels',
        reward_inr: null,
        status: 'active',
        created_at: null,
      },
    ];
    const tags = tagsFor('FitCo', campaigns, { industry: 'fitness' });
    expect(tags.some((t) => t.toLowerCase().includes('fit'))).toBe(true);
  });

  it('falls back to default tags', () => {
    expect(tagsFor('Unknown Brand', [], {})).toEqual(['Lifestyle', 'Culture', 'Audience fit']);
  });
});

describe('matchLineFor', () => {
  it('builds match copy from tags and brief', () => {
    const line = matchLineFor(['Fashion', 'Beauty'], 'Summer drop');
    expect(line).toContain('Fashion');
    expect(line).toContain('summer drop');
  });
});

describe('paletteForBrand', () => {
  it('uses identity palette when present', () => {
    expect(paletteForBrand('uuid-1', { colorPalette: ['#111', '#222'] })).toEqual(['#111', '#222']);
  });

  it('returns deterministic fallback palette', () => {
    const a = paletteForBrand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {});
    const b = paletteForBrand('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {});
    expect(a.length).toBe(3);
    expect(a).toEqual(b);
  });
});
