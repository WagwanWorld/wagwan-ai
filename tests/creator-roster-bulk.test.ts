import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertBrandAccess: vi.fn(),
  getServiceSupabase: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  parseAndValidate: vi.fn(),
  processCreatorInvite: vi.fn(),
  resolveBrandForSession: vi.fn(),
}));

vi.mock('$lib/server/supabase', () => ({
  getServiceSupabase: mocks.getServiceSupabase,
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}));

vi.mock('$lib/server/marketplace/brandAuth', () => ({
  assertBrandAccess: mocks.assertBrandAccess,
}));

vi.mock('$lib/server/marketplace/sheetParser', () => ({
  parseAndValidate: mocks.parseAndValidate,
}));

vi.mock('$lib/server/marketplace/creatorInvite', () => ({
  processCreatorInvite: mocks.processCreatorInvite,
  resolveBrandForSession: mocks.resolveBrandForSession,
}));

vi.mock('$lib/server/marketplace/instagramScrape', () => ({
  scrapeInstagram: vi.fn(),
}));

const { POST } = await import('../src/routes/api/brand/creator-roster/bulk/+server');

function createSupabaseMock() {
  const calls: Array<{ table: string; column: string; value: unknown }> = [];

  return {
    calls,
    client: {
      from(table: string) {
        const filters: Record<string, unknown> = {};
        const builder = {
          select: vi.fn(() => builder),
          update: vi.fn(() => builder),
          eq: vi.fn((column: string, value: unknown) => {
            calls.push({ table, column, value });
            filters[column] = value;
            return builder;
          }),
          in: vi.fn((_column: string, _values: string[]) => {
            return {
              data:
                filters.brand_id === 'brand-current'
                  ? []
                  : [{ ig_username: 'sharedcreator' }],
            };
          }),
        };
        return builder;
      },
    },
  };
}

describe('creator roster bulk upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseConfigured.mockReturnValue(true);
    mocks.assertBrandAccess.mockReturnValue('ig-current');
    mocks.resolveBrandForSession.mockResolvedValue({
      brandId: 'brand-current',
      brandName: 'Current Brand',
      brandUsername: 'currentbrand',
      brandIdentity: null,
    });
    mocks.parseAndValidate.mockReturnValue({
      valid: [
        {
          handle: 'sharedcreator',
          custom_fields: {},
        },
      ],
      errors: [],
      skipped_no_handle: 0,
      duplicates_in_file: 0,
      total_rows: 1,
    });
    mocks.processCreatorInvite.mockResolvedValue({
      profile: {},
      entry: { id: 'entry-current' },
      analysis: { fitLabel: 'Good fit', fitScore: 80 },
    });
  });

  it('only skips handles that already exist for the current brand', async () => {
    const supabase = createSupabaseMock();
    mocks.getServiceSupabase.mockReturnValue(supabase.client);

    const body = new FormData();
    body.set('file', new File(['handle\nsharedcreator\n'], 'creators.csv', { type: 'text/csv' }));

    const response = await POST({ request: new Request('https://app.test/bulk', { method: 'POST', body }) });
    const events = await response.text();

    expect(mocks.resolveBrandForSession).toHaveBeenCalledWith(
      supabase.client,
      'ig-current',
      'Brand',
    );
    expect(supabase.calls).toContainEqual({
      table: 'brand_creator_roster',
      column: 'brand_id',
      value: 'brand-current',
    });
    expect(mocks.processCreatorInvite).toHaveBeenCalledWith(
      supabase.client,
      'ig-current',
      'sharedcreator',
      expect.any(Function),
    );
    expect(events).toContain('"valid_count":1');
    expect(events).toContain('"already_in_roster":0');
    expect(events).toContain('"succeeded":1');
  });
});
