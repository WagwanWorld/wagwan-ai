import { beforeEach, describe, expect, it, vi } from 'vitest';

const wagwanAuth = vi.hoisted(() => ({
  extractWagwanUserId: vi.fn(),
  isWagwanAuthConfigured: vi.fn(),
}));

const supabase = vi.hoisted(() => ({
  getProfileByWagwanId: vi.fn(),
}));

const instagram = vi.hoisted(() => ({
  fetchInstagramProfile: vi.fn(),
}));

vi.mock('$lib/server/wagwanAuth', () => wagwanAuth);
vi.mock('$lib/server/supabase', () => supabase);
vi.mock('$lib/server/instagram', () => instagram);

const { assertCreatorAccount } = await import('../src/lib/server/creatorAuth');

describe('assertCreatorAccount', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    wagwanAuth.extractWagwanUserId.mockReturnValue(null);
    wagwanAuth.isWagwanAuthConfigured.mockReturnValue(false);
    supabase.getProfileByWagwanId.mockResolvedValue(null);
    instagram.fetchInstagramProfile.mockReset();
  });

  it('rejects an unproven googleSub claim', async () => {
    await expect(
      assertCreatorAccount(new Request('https://example.com'), 'sub-1', {}),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('accepts a matching Google access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: 'sub-1' }),
      }),
    );

    await expect(
      assertCreatorAccount(new Request('https://example.com'), 'sub-1', {
        googleAccessToken: 'google-token',
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects a Google access token for a different creator', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: 'sub-2' }),
      }),
    );

    await expect(
      assertCreatorAccount(new Request('https://example.com'), 'sub-1', {
        googleAccessToken: 'google-token',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('accepts a matching Instagram account key', async () => {
    instagram.fetchInstagramProfile.mockResolvedValue({
      id: '1789',
      username: 'Creator_Name',
    });

    await expect(
      assertCreatorAccount(new Request('https://example.com'), 'ig:1789', {
        instagramToken: 'ig-token',
      }),
    ).resolves.toBeUndefined();

    await expect(
      assertCreatorAccount(new Request('https://example.com'), 'ig:user:creator_name', {
        instagramToken: 'ig-token',
      }),
    ).resolves.toBeUndefined();
  });

  it('accepts a Wagwan bearer token linked to the claimed profile', async () => {
    wagwanAuth.isWagwanAuthConfigured.mockReturnValue(true);
    wagwanAuth.extractWagwanUserId.mockReturnValue('wagwan-user-1');
    supabase.getProfileByWagwanId.mockResolvedValue({ google_sub: 'sub-1' });

    await expect(
      assertCreatorAccount(
        new Request('https://example.com', {
          headers: { Authorization: 'Bearer wagwan-token' },
        }),
        'sub-1',
        {},
      ),
    ).resolves.toBeUndefined();
  });
});
