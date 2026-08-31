import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryLog = vi.hoisted(() => [] as Array<{ op: string; column?: string; value?: unknown }>);

vi.mock('$lib/server/supabase', () => ({
  isSupabaseConfigured: () => true,
  getServiceSupabase: () => mockSupabase,
}));

vi.mock('$lib/server/marketplace/brandAuth', () => ({
  assertBrandAccess: () => 'brand-ig-user-id',
}));

vi.mock('$lib/server/marketplace/sheetParser', () => ({
  parseAndValidate: () => ({
    valid: [
      {
        handle: 'sharedcreator',
        email: 'creator@example.com',
        phone: '',
        rates: '',
        notes: '',
        tags: '',
        location: '',
        custom_fields: {},
      },
    ],
    errors: [],
    skipped_no_handle: 0,
    duplicates_in_file: 0,
    total_rows: 1,
  }),
}));

vi.mock('$lib/server/marketplace/instagramScrape', () => ({
  scrapeInstagram: vi.fn(),
}));

const processCreatorInvite = vi.hoisted(() =>
  vi.fn(async () => ({
    entry: { id: 'roster-current-brand' },
    profile: { handle: 'sharedcreator', displayName: 'Shared Creator' },
    analysis: { fitLabel: 'Good fit', fitScore: 80 },
  })),
);

vi.mock('$lib/server/marketplace/creatorInvite', () => ({
  resolveBrandForSession: vi.fn(async () => ({
    brandId: 'brand-current',
    brandName: 'Current Brand',
    brandUsername: 'currentbrand',
    brandIdentity: null,
  })),
  processCreatorInvite,
}));

function createQuery(table: string) {
  const filters: Record<string, unknown> = {};
  const query = {
    select() {
      queryLog.push({ op: `${table}.select` });
      return query;
    },
    eq(column: string, value: unknown) {
      filters[column] = value;
      queryLog.push({ op: `${table}.eq`, column, value });
      return query;
    },
    in(column: string, value: unknown) {
      filters[column] = value;
      queryLog.push({ op: `${table}.in`, column, value });
      return query;
    },
    update(value: unknown) {
      queryLog.push({ op: `${table}.update`, value });
      return query;
    },
    then(resolve: (value: unknown) => void) {
      if (
        table === 'brand_creator_roster' &&
        queryLog.some((entry) => entry.op.endsWith('update'))
      ) {
        resolve({ error: null });
        return;
      }

      const scopedToCurrentBrand = filters.brand_id === 'brand-current';
      resolve({
        data: scopedToCurrentBrand ? [] : [{ ig_username: 'sharedcreator' }],
        error: null,
      });
    },
  };

  return query;
}

const mockSupabase = {
  from(table: string) {
    return createQuery(table);
  },
};

describe('bulk creator roster upload', () => {
  beforeEach(() => {
    queryLog.length = 0;
    processCreatorInvite.mockClear();
  });

  it('checks duplicate handles only within the authenticated brand roster', async () => {
    const { POST } = await import('../src/routes/api/brand/creator-roster/bulk/+server');

    const form = new FormData();
    form.set('file', new File(['handle\nsharedcreator\n'], 'creators.csv', { type: 'text/csv' }));

    const response = await POST({
      request: new Request('https://wagwan.test/bulk', { method: 'POST', body: form }),
    } as never);
    const streamText = await response.text();

    expect(streamText).toContain('"valid_count":1');
    expect(processCreatorInvite).toHaveBeenCalledWith(
      mockSupabase,
      'brand-ig-user-id',
      'sharedcreator',
      expect.any(Function),
    );
    expect(queryLog).toContainEqual({
      op: 'brand_creator_roster.eq',
      column: 'brand_id',
      value: 'brand-current',
    });
  });
});
