import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthenticatedCreator = vi.fn();
const listCreatorBrandSignals = vi.fn();
const markSignalsSeen = vi.fn();
const upsertCreatorBrandSignal = vi.fn();
const getServiceSupabase = vi.fn();

vi.mock('$lib/server/creatorAuth', () => ({ requireAuthenticatedCreator }));
vi.mock('$lib/server/creatorSignals', () => ({
  listCreatorBrandSignals,
  markSignalsSeen,
  upsertCreatorBrandSignal,
}));
vi.mock('$lib/server/supabase', () => ({
  getServiceSupabase,
  isSupabaseConfigured: () => true,
}));

describe('creator brand signal auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedCreator.mockResolvedValue({
      googleSub: 'victim-sub',
      profile: { profile_data: { instagramIdentity: { username: 'victim' } } },
    });
    getServiceSupabase.mockReturnValue({ from: vi.fn() });
    listCreatorBrandSignals.mockResolvedValue({ signals: [], unseenCount: 0 });
    markSignalsSeen.mockResolvedValue(true);
  });

  it('lists signals for the authenticated creator, not a query-string googleSub', async () => {
    const { GET } = await import('../src/routes/api/creator/brand-signals/+server');

    await GET({
      request: new Request('https://example.com', {
        headers: { Authorization: 'Bearer token' },
      }),
      url: new URL('https://example.com/api/creator/brand-signals?googleSub=attacker-sub'),
    } as never);

    expect(listCreatorBrandSignals).toHaveBeenCalledWith(expect.anything(), 'victim-sub', {
      seen: undefined,
      signalType: undefined,
    });
  });

  it('marks signals for the authenticated creator, not a body googleSub', async () => {
    const { PATCH } = await import('../src/routes/api/creator/brand-signals/+server');

    await PATCH({
      request: new Request('https://example.com', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ googleSub: 'attacker-sub', id: 'signal-1' }),
      }),
    } as never);

    expect(markSignalsSeen).toHaveBeenCalledWith(expect.anything(), 'victim-sub', {
      id: 'signal-1',
      markAllSeen: false,
    });
  });
});

describe('creator invite linkback auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedCreator.mockResolvedValue({
      googleSub: 'creator-sub',
      profile: { profile_data: { instagramIdentity: { username: 'right_creator' } } },
    });
    upsertCreatorBrandSignal.mockResolvedValue({ id: 'signal-1' });
  });

  function makeSupabase(rosterIgUsername: string) {
    const update = vi.fn();
    const tables: Record<string, unknown[]> = {};
    const from = vi.fn((table: string) => {
      if (table === 'brand_creator_roster') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'roster-1',
              ig_username: rosterIgUsername,
              analysis_snapshot: { fitLabel: 'Good fit', fitScore: 72 },
              invite_message: 'Join us',
            },
            error: null,
          }),
          update,
        };
      }
      if (table === 'brand_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { ig_username: 'brand', ig_name: 'Brand', ig_profile_picture: null },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Brand' } }),
      };
    });

    update.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: 'roster-1' }], error: null }),
    });

    tables.brand_creator_roster = [update];
    return { sb: { from }, update };
  }

  it('does not mutate a roster invite when the authenticated Instagram username does not match', async () => {
    const { POST } = await import('../src/routes/api/creator/link-invite/+server');
    const { sb, update } = makeSupabase('someone_else');
    getServiceSupabase.mockReturnValue(sb);

    await expect(
      POST({
        request: new Request('https://example.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
          body: JSON.stringify({
            googleSub: 'attacker-sub',
            brandId: 'brand-1',
            rosterId: 'roster-1',
          }),
        }),
      } as never),
    ).rejects.toMatchObject({ status: 403 });

    expect(update).not.toHaveBeenCalled();
    expect(upsertCreatorBrandSignal).not.toHaveBeenCalled();
  });
});
