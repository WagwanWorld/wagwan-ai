import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sb: { from: vi.fn() },
  upsertCreatorBrandSignal: vi.fn(),
  requireAuthenticatedCreator: vi.fn(),
}));

type QueryCall = { table: string; method: string; args: unknown[] };
const queryCalls: QueryCall[] = [];

function makeQuery(table: string) {
  const state = { operation: 'select' };
  const query = {
    select: (...args: unknown[]) => {
      queryCalls.push({ table, method: 'select', args });
      return query;
    },
    update: (...args: unknown[]) => {
      state.operation = 'update';
      queryCalls.push({ table, method: 'update', args });
      return query;
    },
    eq: (...args: unknown[]) => {
      queryCalls.push({ table, method: 'eq', args });
      return query;
    },
    is: (...args: unknown[]) => {
      queryCalls.push({ table, method: 'is', args });
      return query;
    },
    limit: (...args: unknown[]) => {
      queryCalls.push({ table, method: 'limit', args });
      return query;
    },
    maybeSingle: async () => {
      queryCalls.push({ table, method: 'maybeSingle', args: [] });
      if (table === 'brand_creator_roster' && state.operation === 'update') {
        return { data: { id: 'roster-1' }, error: null };
      }
      if (table === 'brand_creator_roster') {
        return {
          data: {
            id: 'roster-1',
            ig_username: 'creator.one',
            analysis_snapshot: { fitLabel: 'Good fit', fitScore: 72 },
            invite_message: 'Join us',
          },
          error: null,
        };
      }
      if (table === 'brand_accounts') {
        return {
          data: {
            ig_username: 'brand',
            ig_name: 'Brand',
            ig_profile_picture: 'https://example.test/brand.jpg',
          },
          error: null,
        };
      }
      if (table === 'brands') {
        return { data: { name: 'Brand fallback' }, error: null };
      }
      return { data: null, error: null };
    },
  };
  return query;
}

vi.mock('$lib/server/supabase', () => ({
  getServiceSupabase: vi.fn(() => mocks.sb),
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock('$lib/server/creatorSignals', () => ({
  upsertCreatorBrandSignal: mocks.upsertCreatorBrandSignal,
}));

vi.mock('$lib/server/creatorAuth', () => ({
  creatorInstagramUsername: vi.fn(() => 'creator.one'),
  requireAuthenticatedCreator: mocks.requireAuthenticatedCreator,
}));

describe('/api/creator/link-invite ownership checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCalls.length = 0;
    mocks.sb.from.mockImplementation((table: string) => makeQuery(table));
    mocks.requireAuthenticatedCreator.mockResolvedValue({
      googleSub: 'creator-sub-from-token',
      wagwanUserId: 'wagwan-user-1',
      profileData: {},
    });
  });

  it('claims only the authenticated creator matching an unclaimed prospect roster row', async () => {
    const { POST } = await import('../src/routes/api/creator/link-invite/+server');
    const request = new Request('https://example.test/api/creator/link-invite', {
      method: 'POST',
      body: JSON.stringify({
        googleSub: 'attacker-sub',
        brandId: 'brand-1',
        rosterId: 'roster-1',
      }),
    });

    await POST({ request } as never);

    expect(queryCalls).toContainEqual({
      table: 'brand_creator_roster',
      method: 'eq',
      args: ['brand_id', 'brand-1'],
    });
    expect(queryCalls).toContainEqual({
      table: 'brand_creator_roster',
      method: 'eq',
      args: ['status', 'prospect'],
    });
    expect(queryCalls).toContainEqual({
      table: 'brand_creator_roster',
      method: 'is',
      args: ['user_google_sub', null],
    });
    expect(mocks.upsertCreatorBrandSignal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        creator_google_sub: 'creator-sub-from-token',
        brand_id: 'brand-1',
        roster_entry_id: 'roster-1',
      }),
    );
  });
});
