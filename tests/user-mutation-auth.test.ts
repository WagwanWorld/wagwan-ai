import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {} as { CRON_SECRET?: string },
  extractWagwanUserId: vi.fn(),
  getProfileByWagwanId: vi.fn(),
  isWagwanAuthConfigured: vi.fn(),
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/wagwanAuth', () => ({
  extractWagwanUserId: mocks.extractWagwanUserId,
  isWagwanAuthConfigured: mocks.isWagwanAuthConfigured,
}));
vi.mock('$lib/server/supabase', () => ({
  getProfileByWagwanId: mocks.getProfileByWagwanId,
}));

const { authorizeUserGoogleSub } = await import('../src/lib/server/userMutationAuth');

function requestWithBearer(token?: string): Request {
  return new Request('https://wagwan.test/api/user/wallet/withdraw', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('authorizeUserGoogleSub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete mocks.env.CRON_SECRET;
    mocks.isWagwanAuthConfigured.mockReturnValue(true);
    mocks.extractWagwanUserId.mockReturnValue('wagwan-user-1');
    mocks.getProfileByWagwanId.mockResolvedValue({ google_sub: 'google-sub-1' });
  });

  it('authorizes the google_sub linked to the caller Wagwan token', async () => {
    const result = await authorizeUserGoogleSub(requestWithBearer('valid-token'), 'google-sub-1');

    expect(result).toEqual({ ok: true, googleSub: 'google-sub-1' });
    expect(mocks.getProfileByWagwanId).toHaveBeenCalledWith('wagwan-user-1');
  });

  it('rejects unauthenticated user mutations before reading the body googleSub as trusted', async () => {
    mocks.extractWagwanUserId.mockReturnValue(null);

    const result = await authorizeUserGoogleSub(new Request('https://wagwan.test'), 'victim-sub');

    expect(result).toMatchObject({ ok: false, status: 401, error: 'invalid_or_missing_token' });
    expect(mocks.getProfileByWagwanId).not.toHaveBeenCalled();
  });

  it('rejects attempts to mutate a different profile than the linked Wagwan account', async () => {
    const result = await authorizeUserGoogleSub(requestWithBearer('valid-token'), 'victim-sub');

    expect(result).toEqual({ ok: false, status: 403, error: 'google_sub_mismatch' });
  });

  it('allows cron settlement only when the cron secret option and bearer secret match', async () => {
    mocks.env.CRON_SECRET = 'cron-secret';
    mocks.isWagwanAuthConfigured.mockReturnValue(false);

    const result = await authorizeUserGoogleSub(requestWithBearer('cron-secret'), 'google-sub-2', {
      allowCronSecret: true,
    });

    expect(result).toEqual({ ok: true, googleSub: 'google-sub-2' });
    expect(mocks.extractWagwanUserId).not.toHaveBeenCalled();
  });

  it('does not treat the cron secret as user auth unless explicitly allowed', async () => {
    mocks.env.CRON_SECRET = 'cron-secret';
    mocks.isWagwanAuthConfigured.mockReturnValue(false);

    const result = await authorizeUserGoogleSub(requestWithBearer('cron-secret'), 'google-sub-2');

    expect(result).toMatchObject({ ok: false, status: 503, error: 'wagwan_auth_not_configured' });
  });
});
