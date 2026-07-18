import { beforeEach, describe, expect, it, vi } from 'vitest';
import { respondToBrief } from '../src/lib/server/creatorMarketplace';
import { getServiceSupabase } from '../src/lib/server/supabase';

vi.mock('../src/lib/server/supabase', () => ({
  getServiceSupabase: vi.fn(),
}));

function createBriefResponseQuery(result: Record<string, unknown> | null) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const query = {
    from(...args: unknown[]) {
      calls.push({ method: 'from', args });
      return query;
    },
    update(...args: unknown[]) {
      calls.push({ method: 'update', args });
      return query;
    },
    upsert(...args: unknown[]) {
      calls.push({ method: 'upsert', args });
      return query;
    },
    eq(...args: unknown[]) {
      calls.push({ method: 'eq', args });
      return query;
    },
    select(...args: unknown[]) {
      calls.push({ method: 'select', args });
      return query;
    },
    maybeSingle: vi.fn().mockResolvedValue({ data: result, error: null }),
  };
  return { query, calls };
}

describe('creatorMarketplace brief transitions', () => {
  beforeEach(() => {
    vi.mocked(getServiceSupabase).mockReset();
  });

  it('accepts by updating an existing sent brief instead of upserting a new assignment', async () => {
    const row = {
      id: 1,
      campaign_id: '1f3a9d22-0b3b-4d4b-9f8b-6a2d8c8f4e1c',
      user_google_sub: 'creator-sub',
      status: 'accepted',
    };
    const { query, calls } = createBriefResponseQuery(row);
    vi.mocked(getServiceSupabase).mockReturnValue(query as never);

    await expect(
      respondToBrief('creator-sub', '1f3a9d22-0b3b-4d4b-9f8b-6a2d8c8f4e1c', 'accept'),
    ).resolves.toMatchObject({ status: 'accepted' });

    expect(calls).toContainEqual({ method: 'from', args: ['brief_responses'] });
    expect(calls.some((call) => call.method === 'upsert')).toBe(false);
    expect(calls).toContainEqual({ method: 'eq', args: ['user_google_sub', 'creator-sub'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['status', 'sent'] });
  });

  it('returns null when there is no seeded sent row for that creator and campaign', async () => {
    const { query } = createBriefResponseQuery(null);
    vi.mocked(getServiceSupabase).mockReturnValue(query as never);

    await expect(
      respondToBrief('creator-sub', '1f3a9d22-0b3b-4d4b-9f8b-6a2d8c8f4e1c', 'accept'),
    ).resolves.toBeNull();
  });
});
