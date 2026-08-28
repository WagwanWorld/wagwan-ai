import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listCreatorBrandSignals: vi.fn(),
  markSignalsSeen: vi.fn(),
  requireAuthenticatedCreator: vi.fn(),
}));

vi.mock('$lib/server/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({ from: vi.fn() })),
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock('$lib/server/creatorSignals', () => ({
  listCreatorBrandSignals: mocks.listCreatorBrandSignals,
  markSignalsSeen: mocks.markSignalsSeen,
}));

vi.mock('$lib/server/creatorAuth', () => ({
  requireAuthenticatedCreator: mocks.requireAuthenticatedCreator,
}));

describe('/api/creator/brand-signals auth scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedCreator.mockResolvedValue({
      googleSub: 'creator-sub-from-token',
      wagwanUserId: 'wagwan-user-1',
      profileData: {},
    });
    mocks.listCreatorBrandSignals.mockResolvedValue({ signals: [], unseenCount: 0 });
    mocks.markSignalsSeen.mockResolvedValue(true);
  });

  it('lists signals for the authenticated creator, not a query parameter', async () => {
    const { GET } = await import('../src/routes/api/creator/brand-signals/+server');
    const url = new URL('https://example.test/api/creator/brand-signals?googleSub=attacker-sub');

    await GET({ request: new Request(url), url } as never);

    expect(mocks.requireAuthenticatedCreator).toHaveBeenCalledTimes(1);
    expect(mocks.listCreatorBrandSignals).toHaveBeenCalledWith(
      expect.anything(),
      'creator-sub-from-token',
      expect.any(Object),
    );
    expect(mocks.listCreatorBrandSignals).not.toHaveBeenCalledWith(
      expect.anything(),
      'attacker-sub',
      expect.any(Object),
    );
  });

  it('marks signals seen for the authenticated creator, not the request body googleSub', async () => {
    const { PATCH } = await import('../src/routes/api/creator/brand-signals/+server');
    const request = new Request('https://example.test/api/creator/brand-signals', {
      method: 'PATCH',
      body: JSON.stringify({ googleSub: 'attacker-sub', id: 'signal-1' }),
    });

    await PATCH({ request } as never);

    expect(mocks.requireAuthenticatedCreator).toHaveBeenCalledTimes(1);
    expect(mocks.markSignalsSeen).toHaveBeenCalledWith(
      expect.anything(),
      'creator-sub-from-token',
      {
        id: 'signal-1',
        markAllSeen: false,
      },
    );
  });
});
