import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sb: null as ReturnType<typeof createSupabaseMock> | null,
  extractWagwanUserId: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  isWagwanAuthConfigured: vi.fn(),
  upsertCreatorBrandSignal: vi.fn(),
}));

vi.mock('$lib/server/supabase', () => ({
  getServiceSupabase: vi.fn(() => mocks.sb),
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));

vi.mock('$lib/server/wagwanAuth', () => ({
  extractWagwanUserId: mocks.extractWagwanUserId,
  isWagwanAuthConfigured: mocks.isWagwanAuthConfigured,
}));

vi.mock('$lib/server/creatorSignals', () => ({
  upsertCreatorBrandSignal: mocks.upsertCreatorBrandSignal,
}));

import { POST } from '../src/routes/api/creator/link-invite/+server';

type Filter = { op: 'eq' | 'is'; column: string; value: unknown };
type UpdateCall = { table: string; values: Record<string, unknown>; filters: Filter[] };

function createSupabaseMock(options: {
  profile?: Record<string, unknown> | null;
  roster?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
}) {
  const updates: UpdateCall[] = [];

  const sb = {
    updates,
    from: vi.fn((table: string) => {
      const state: {
        op: 'select' | 'update';
        values: Record<string, unknown> | null;
        filters: Filter[];
      } = { op: 'select', values: null, filters: [] };

      const builder = {
        select: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          state.filters.push({ op: 'eq', column, value });
          return builder;
        }),
        is: vi.fn((column: string, value: unknown) => {
          state.filters.push({ op: 'is', column, value });
          return builder;
        }),
        update: vi.fn((values: Record<string, unknown>) => {
          state.op = 'update';
          state.values = values;
          updates.push({ table, values, filters: state.filters });
          return builder;
        }),
        maybeSingle: vi.fn(async () => {
          if (table === 'user_profiles') return { data: options.profile ?? null, error: null };
          if (table === 'brand_creator_roster')
            return { data: options.roster ?? null, error: null };
          if (table === 'brand_accounts') {
            return {
              data: {
                ig_username: 'brandhandle',
                ig_name: 'Brand Name',
                ig_profile_picture: null,
              },
              error: null,
            };
          }
          if (table === 'brands') return { data: { name: 'Fallback Brand' }, error: null };
          return { data: null, error: null };
        }),
        single: vi.fn(async () =>
          options.updateError
            ? { data: null, error: options.updateError }
            : { data: { id: 'roster-1' }, error: null },
        ),
      };

      return builder;
    }),
  };

  return sb;
}

function linkRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/creator/link-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/creator/link-invite', () => {
  beforeEach(() => {
    mocks.extractWagwanUserId.mockReset();
    mocks.isSupabaseConfigured.mockReturnValue(true);
    mocks.isWagwanAuthConfigured.mockReturnValue(true);
    mocks.upsertCreatorBrandSignal.mockReset().mockResolvedValue({ id: 'sig-1' });
  });

  it('rejects requests without an authenticated linked creator', async () => {
    mocks.extractWagwanUserId.mockReturnValue(null);
    mocks.sb = createSupabaseMock({});

    const res = await POST({
      request: linkRequest({ brandId: 'brand-1', rosterId: 'roster-1' }),
    } as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('invalid_or_unlinked_creator_token');
    expect(mocks.upsertCreatorBrandSignal).not.toHaveBeenCalled();
  });

  it('rejects an invite claim when the linked creator Instagram does not match the roster', async () => {
    mocks.extractWagwanUserId.mockReturnValue('wagwan-1');
    mocks.sb = createSupabaseMock({
      profile: {
        google_sub: 'creator-sub',
        profile_data: { instagramIdentity: { username: 'bob' } },
      },
      roster: {
        id: 'roster-1',
        ig_username: 'alice',
        analysis_snapshot: {},
        invite_message: 'join us',
      },
    });

    const res = await POST({
      request: linkRequest({ brandId: 'brand-1', rosterId: 'roster-1' }),
    } as never);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('invite_creator_mismatch');
    expect(mocks.sb.updates).toEqual([]);
    expect(mocks.upsertCreatorBrandSignal).not.toHaveBeenCalled();
  });

  it('claims a matching invite for the authenticated profile, ignoring supplied googleSub', async () => {
    mocks.extractWagwanUserId.mockReturnValue('wagwan-1');
    mocks.sb = createSupabaseMock({
      profile: {
        google_sub: 'real-creator-sub',
        profile_data: { instagramIdentity: { username: '@alice' } },
      },
      roster: {
        id: 'roster-1',
        ig_username: 'alice',
        analysis_snapshot: { fitLabel: 'Good fit', fitScore: 74 },
        invite_message: 'join us',
      },
    });

    const res = await POST({
      request: linkRequest({
        googleSub: 'attacker-sub',
        brandId: 'brand-1',
        rosterId: 'roster-1',
      }),
    } as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.sb.updates[0]).toMatchObject({
      table: 'brand_creator_roster',
      values: {
        status: 'on_platform',
        user_google_sub: 'real-creator-sub',
      },
    });
    expect(mocks.sb.updates[0].filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: 'id', value: 'roster-1' },
        { op: 'eq', column: 'brand_id', value: 'brand-1' },
        { op: 'eq', column: 'status', value: 'prospect' },
        { op: 'is', column: 'user_google_sub', value: null },
      ]),
    );
    expect(mocks.upsertCreatorBrandSignal).toHaveBeenCalledWith(
      mocks.sb,
      expect.objectContaining({
        creator_google_sub: 'real-creator-sub',
        brand_id: 'brand-1',
        roster_entry_id: 'roster-1',
        invite_message: 'join us',
        fit_label: 'Good fit',
        fit_score: 74,
      }),
    );
  });
});
