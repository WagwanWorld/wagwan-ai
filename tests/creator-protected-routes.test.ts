import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertCreatorProfileFromRequest: vi.fn(),
  respondToBrief: vi.fn(),
  completeBrief: vi.fn(),
  withdrawAvailableEarnings: vi.fn(),
  getProfile: vi.fn(),
  updateProfileData: vi.fn(),
}));

vi.mock('$lib/server/creatorAuth', () => ({
  assertCreatorProfileFromRequest: mocks.assertCreatorProfileFromRequest,
}));

vi.mock('$lib/server/creatorMarketplace', () => ({
  respondToBrief: mocks.respondToBrief,
  completeBrief: mocks.completeBrief,
  withdrawAvailableEarnings: mocks.withdrawAvailableEarnings,
}));

vi.mock('$lib/server/flowState', () => ({
  isCampaignUuid: () => true,
}));

vi.mock('$lib/server/supabase', () => ({
  isSupabaseConfigured: () => true,
  getProfile: mocks.getProfile,
  updateProfileData: mocks.updateProfileData,
}));

import { POST as briefResponsePost } from '../src/routes/api/creator/brief-response/+server';
import { POST as withdrawPost } from '../src/routes/api/user/wallet/withdraw/+server';
import { PUT as chatThreadPut } from '../src/routes/api/chat/thread/+server';

function jsonRequest(body: unknown): Request {
  return new Request('https://example.test/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  });
}

describe('creator protected routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCreatorProfileFromRequest.mockResolvedValue({ googleSub: 'auth-sub' });
  });

  it('uses authenticated creator identity for brief responses', async () => {
    mocks.respondToBrief.mockResolvedValue({ id: 1, status: 'accepted' });

    const res = await briefResponsePost({
      request: jsonRequest({
        sub: 'spoofed-sub',
        campaignId: 'campaign-id',
        action: 'accept',
      }),
    } as never);

    expect(res.status).toBe(200);
    expect(mocks.respondToBrief).toHaveBeenCalledWith('auth-sub', 'campaign-id', 'accept');
  });

  it('uses authenticated creator identity for wallet withdrawals', async () => {
    mocks.withdrawAvailableEarnings.mockResolvedValue({ amount: 1000, rowIds: ['row-1'] });

    const res = await withdrawPost({
      request: jsonRequest({ googleSub: 'spoofed-sub' }),
    } as never);

    expect(res.status).toBe(200);
    expect(mocks.withdrawAvailableEarnings).toHaveBeenCalledWith('auth-sub');
  });

  it('uses authenticated creator identity for chat thread writes', async () => {
    mocks.updateProfileData.mockResolvedValue(true);

    const res = await chatThreadPut({
      request: jsonRequest({
        googleSub: 'spoofed-sub',
        thread: { version: 2, messages: [] },
      }),
    } as never);

    expect(res.status).toBe(200);
    expect(mocks.updateProfileData).toHaveBeenCalledWith('auth-sub', {
      twinChatThread: { version: 2, messages: [] },
    });
  });
});
