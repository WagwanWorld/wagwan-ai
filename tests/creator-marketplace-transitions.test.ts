import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryCall = { method: string; args: unknown[] };

const supabaseMock = vi.hoisted(() => {
  const state: { calls: QueryCall[] } = { calls: [] };

  const chain = {
    update: (...args: unknown[]) => {
      state.calls.push({ method: 'update', args });
      return chain;
    },
    eq: (...args: unknown[]) => {
      state.calls.push({ method: 'eq', args });
      return chain;
    },
    in: (...args: unknown[]) => {
      state.calls.push({ method: 'in', args });
      return chain;
    },
    select: (...args: unknown[]) => {
      state.calls.push({ method: 'select', args });
      return chain;
    },
    maybeSingle: async () => {
      state.calls.push({ method: 'maybeSingle', args: [] });
      return { data: null, error: null };
    },
  };

  return {
    state,
    client: {
      from: (table: string) => {
        state.calls.push({ method: 'from', args: [table] });
        return chain;
      },
    },
  };
});

vi.mock('../src/lib/server/supabase', () => ({
  getServiceSupabase: () => supabaseMock.client,
}));

const { completeBrief, respondToBrief } = await import('../src/lib/server/creatorMarketplace');

describe('creator marketplace transition queries', () => {
  beforeEach(() => {
    supabaseMock.state.calls = [];
  });

  it('only accepts or declines briefs that are still sent', async () => {
    await respondToBrief('user-1', '11111111-1111-1111-1111-111111111111', 'accept');

    expect(supabaseMock.state.calls).toEqual(
      expect.arrayContaining([
        { method: 'from', args: ['brief_responses'] },
        {
          method: 'update',
          args: [
            expect.objectContaining({
              status: 'accepted',
            }),
          ],
        },
        { method: 'eq', args: ['campaign_id', '11111111-1111-1111-1111-111111111111'] },
        { method: 'eq', args: ['user_google_sub', 'user-1'] },
        { method: 'eq', args: ['status', 'sent'] },
        { method: 'maybeSingle', args: [] },
      ]),
    );
  });

  it('only completes briefs after the brand has marked them live', async () => {
    await completeBrief('user-1', '11111111-1111-1111-1111-111111111111', 'https://ig/p/1');

    expect(supabaseMock.state.calls).toEqual(
      expect.arrayContaining([
        { method: 'from', args: ['brief_responses'] },
        {
          method: 'update',
          args: [
            expect.objectContaining({
              status: 'completed',
              ig_post_url: 'https://ig/p/1',
            }),
          ],
        },
        { method: 'eq', args: ['campaign_id', '11111111-1111-1111-1111-111111111111'] },
        { method: 'eq', args: ['user_google_sub', 'user-1'] },
        { method: 'eq', args: ['status', 'live'] },
      ]),
    );
    expect(supabaseMock.state.calls).not.toContainEqual({
      method: 'in',
      args: ['status', ['accepted', 'live']],
    });
  });
});
