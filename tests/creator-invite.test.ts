import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, it, expect, vi } from 'vitest';
import {
  normalizeIgHandle,
  buildSimpleCreatorAnalysisRuleOnly,
  buildRosterProfileSnapshot,
  buildFeedSummary,
  parseFollowerCount,
} from '../src/lib/server/marketplace/creatorInviteUtils';
import { partitionRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRoster';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';
import { rosterEntryToView } from '../src/lib/utils/creatorCardView';
import type { BrandCreatorRosterEntry } from '../src/lib/types/creator-invite';

describe('normalizeIgHandle', () => {
  it('strips @ and lowercases', () => {
    expect(normalizeIgHandle('@Creator_Name')).toBe('creator_name');
  });

  it('parses instagram URL', () => {
    expect(normalizeIgHandle('https://www.instagram.com/some.user/')).toBe('some.user');
  });

  it('rejects invalid handles', () => {
    expect(normalizeIgHandle('a')).toBeNull();
    expect(normalizeIgHandle('bad handle!')).toBeNull();
  });
});

describe('parseFollowerCount', () => {
  it('parses K and M suffixes', () => {
    expect(parseFollowerCount('12.5K')).toBe(12500);
    expect(parseFollowerCount('1.2M')).toBe(1200000);
  });
});

describe('buildSimpleCreatorAnalysisRuleOnly', () => {
  const scrape = {
    bio: 'Fashion and lifestyle creator based in Mumbai',
    followers: '25K',
    following: '400',
    posts: '120',
    fullName: 'Test Creator',
    isVerified: false,
    recentCaptions: [],
  };

  it('returns prospect analysis for scrape-only', () => {
    const analysis = buildSimpleCreatorAnalysisRuleOnly({
      scrape,
      wagwan: null,
      brandIdentity: null,
    });
    expect(analysis.dataSource).toBe('public_scrape');
    expect(analysis.summary.length).toBeGreaterThan(10);
    expect(analysis.highlights.length).toBeGreaterThan(0);
    expect(analysis.signals.some((s) => s.label === 'Followers')).toBe(true);
  });

  it('returns on_platform analysis when wagwan match exists', () => {
    const analysis = buildSimpleCreatorAnalysisRuleOnly({
      scrape,
      wagwan: {
        google_sub: 'sub-1',
        name: 'Test Creator',
        profile_data: {
          instagramIdentity: {
            username: 'testcreator',
            followersCount: 25000,
          },
        },
        identity_graph: {
          city: 'Mumbai',
          contentCategories: ['fashion', 'lifestyle'],
        },
      },
      brandIdentity: null,
    });
    expect(analysis.dataSource).toBe('wagwan');
    expect(analysis.fitScore).not.toBeNull();
  });
});

describe('buildRosterProfileSnapshot', () => {
  const scrape = {
    bio: 'Fashion creator',
    followers: '8.2K',
    following: '400',
    posts: '115',
    fullName: 'Riya Hundi',
    isVerified: false,
    recentCaptions: ['OOTD in Mumbai', 'Weekend style diary'],
    profilePictureUrl: 'https://cdn.example.com/riya.jpg',
  };

  it('builds prospect snapshot from scrape only', () => {
    const snap = buildRosterProfileSnapshot({ scrape, wagwan: null, handle: 'riyahundi' });
    expect(snap.handle).toBe('riyahundi');
    expect(snap.onPlatform).toBe(false);
    expect(snap.followers).toBe('8.2K');
    expect(snap.following).toBe('400');
    expect(snap.followersCount).toBe(8200);
    expect(snap.scrapedAt).toBeTruthy();
    expect(snap.archetype).toBeUndefined();
  });

  it('includes wagwan identity fields when on platform', () => {
    const snap = buildRosterProfileSnapshot({
      scrape,
      handle: 'testcreator',
      wagwan: {
        google_sub: 'sub-1',
        name: 'Test Creator',
        profile_data: {
          instagramIdentity: {
            username: 'testcreator',
            followersCount: 25000,
            profilePicture: 'https://example.com/p.jpg',
            visual: { colorPalette: ['#111', '#222'] },
          },
        },
        identity_graph: {
          city: 'Mumbai',
          identitySnapshot: {
            payload: { archetype: 'The Curator', vibe: ['minimal', 'editorial'] },
          },
          contentCategories: ['fashion'],
        },
      },
    });
    expect(snap.onPlatform).toBe(true);
    expect(snap.archetype).toBe('The Curator');
    expect(snap.location).toBe('Mumbai');
    expect(snap.strengthScore).toBeGreaterThan(0);
    expect(snap.colorPalette).toEqual(['#111', '#222']);
    expect(snap.vibeTags).toContain('minimal');
  });

  it('includes profile picture and feed summary for prospects', () => {
    const snap = buildRosterProfileSnapshot({ scrape, wagwan: null, handle: 'riyahundi' });
    expect(snap.profilePicture).toBe('https://cdn.example.com/riya.jpg');
    expect(snap.recentCaptions?.length).toBeGreaterThan(0);
    expect(snap.feedSummary).toBeTruthy();
  });
});

describe('buildFeedSummary', () => {
  it('detects themes from captions', () => {
    const { feedSummary, contentThemes } = buildFeedSummary({
      bio: 'Fashion blogger',
      captions: ['New outfit drop', 'Style tips for summer'],
      tags: ['fashion'],
    });
    expect(feedSummary.length).toBeGreaterThan(10);
    expect(contentThemes.length).toBeGreaterThan(0);
  });
});

describe('rosterEntryToView', () => {
  it('maps roster entry to featured card view', () => {
    const entry: BrandCreatorRosterEntry = {
      id: 'r1',
      brand_id: 'b1',
      ig_username: 'testcreator',
      display_name: 'Test Creator',
      profile_snapshot: {
        handle: 'testcreator',
        displayName: 'Test Creator',
        bio: 'Creator bio',
        profilePicture: 'https://example.com/p.jpg',
        followers: '12K',
        followersCount: 12000,
        following: '200',
        posts: '50',
        isVerified: false,
        onPlatform: true,
        archetype: 'The Curator',
        strengthScore: 72,
        strengthLabel: 'strong',
        feedSummary: 'Recent posts lean fashion.',
        scrapedAt: new Date().toISOString(),
      },
      user_google_sub: 'sub-1',
      invite_message: 'Hi',
      onboarding_url: 'https://example.com/onboarding',
      analysis_snapshot: {
        dataSource: 'wagwan',
        summary: 'Good match',
        highlights: ['Strong signal'],
        fitLabel: 'Good fit',
        fitScore: 68,
        signals: [],
      },
      status: 'on_platform',
      delivery_status: 'draft',
      sent_at: null,
      created_at: '',
      updated_at: '',
    };
    const view = rosterEntryToView(entry);
    expect(view.handle).toBe('testcreator');
    expect(view.profilePicture).toBe('https://example.com/p.jpg');
    expect(view.fitScore).toBe(68);
    expect(view.feedSummary).toContain('fashion');
  });
});

describe('partitionRowsByBrandRoster', () => {
  it('only treats rows as existing when they are in the current brand roster', async () => {
    const rows: ParsedCreatorRow[] = [
      { row: 1, handle: 'sharedcreator', custom_fields: {} },
      { row: 2, handle: 'newcreator', custom_fields: {} },
    ];

    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockResolvedValue({
      data: [{ ig_username: 'sharedcreator' }],
      error: null,
    });

    const sb = {
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient;

    const partition = await partitionRowsByBrandRoster(sb, 'brand-b', rows);

    expect(sb.from).toHaveBeenCalledWith('brand_creator_roster');
    expect(query.eq).toHaveBeenCalledWith('brand_id', 'brand-b');
    expect(query.in).toHaveBeenCalledWith('ig_username', ['sharedcreator', 'newcreator']);
    expect(partition.alreadyInRoster).toBe(1);
    expect(partition.toProcess.map((r) => r.handle)).toEqual(['newcreator']);
  });
});
