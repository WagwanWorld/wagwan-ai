import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../src/routes/api/brand/creator-roster/bulk/+server';

const bulkMock = vi.hoisted(() => ({
  eqCalls: [] as Array<[string, unknown]>,
  inCalls: [] as Array<[string, unknown[]]>,
  updateCalls: [] as unknown[],
}));

vi.mock('$lib/server/supabase', () => ({
  isSupabaseConfigured: () => true,
  getServiceSupabase: () => ({
    from: () => ({
      select() {
        return this;
      },
      eq(column: string, value: unknown) {
        bulkMock.eqCalls.push([column, value]);
        return this;
      },
      in(column: string, values: unknown[]) {
        bulkMock.inCalls.push([column, values]);
        return Promise.resolve({ data: [] });
      },
      update(value: unknown) {
        bulkMock.updateCalls.push(value);
        return this;
      },
      maybeSingle() {
        return Promise.resolve({ data: null });
      },
      single() {
        return Promise.resolve({ data: null });
      },
    }),
  }),
}));

vi.mock('$lib/server/marketplace/brandAuth', () => ({
  assertBrandAccess: () => 'brand-ig-user-id',
}));

vi.mock('$lib/server/marketplace/instagramScrape', () => ({
  scrapeInstagram: vi.fn(),
}));

vi.mock('$lib/server/marketplace/creatorInvite', () => ({
  resolveBrandForSession: () =>
    Promise.resolve({
      brandId: 'brand-a',
      brandName: 'Brand A',
      brandUsername: 'branda',
      brandIdentity: null,
    }),
  processCreatorInvite: () =>
    Promise.resolve({
      entry: { id: 'entry-a' },
      profile: { handle: 'creator_a', displayName: 'Creator A' },
      analysis: { fitLabel: 'Good fit', fitScore: 64 },
    }),
}));

describe('bulk creator roster upload', () => {
  beforeEach(() => {
    bulkMock.eqCalls.length = 0;
    bulkMock.inCalls.length = 0;
    bulkMock.updateCalls.length = 0;
  });

  it('checks and updates roster rows within the authenticated brand only', async () => {
    const file = new File(['handle,email\ncreator_a,creator@example.com\n'], 'creators.csv', {
      type: 'text/csv',
    });
    const formData = new FormData();
    formData.set('file', file);

    const response = await POST({
      request: {
        formData: () => Promise.resolve(formData),
      } as unknown as Request,
    } as Parameters<typeof POST>[0]);

    await response.text();

    expect(bulkMock.inCalls).toEqual([['ig_username', ['creator_a']]]);
    expect(bulkMock.eqCalls).toContainEqual(['brand_id', 'brand-a']);
    expect(bulkMock.eqCalls).toContainEqual(['id', 'entry-a']);
    expect(
      bulkMock.updateCalls.some((value) =>
        JSON.stringify(value).includes('"email":"creator@example.com"'),
      ),
    ).toBe(true);
  });
});
