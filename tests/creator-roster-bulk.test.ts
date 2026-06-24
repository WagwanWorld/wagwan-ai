import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  supabaseClient: null as ReturnType<typeof createSupabaseMock> | null,
  assertBrandAccess: vi.fn(),
  parseAndValidate: vi.fn(),
  processCreatorInvite: vi.fn(),
  resolveBrandForSession: vi.fn(),
}));

function createSupabaseMock() {
  const queries: Array<{
    brandId: string | null;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  }> = [];

  const from = vi.fn(() => {
    const query = {
      brandId: null as string | null,
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: string) => {
        if (column === 'brand_id') {
          query.brandId = value;
        }
        return query;
      }),
      in: vi.fn(async () => ({
        data: query.brandId === 'brand-current' ? [] : [{ ig_username: 'sharedcreator' }],
        error: null,
      })),
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: null, error: null })),
      })),
    };
    queries.push(query);
    return query;
  });

  return { from, queries };
}

vi.mock('$lib/server/supabase', () => ({
  isSupabaseConfigured: () => true,
  getServiceSupabase: () => mocks.supabaseClient,
}));

vi.mock('$lib/server/marketplace/brandAuth', () => ({
  assertBrandAccess: mocks.assertBrandAccess,
}));

vi.mock('$lib/server/marketplace/creatorInvite', () => ({
  processCreatorInvite: mocks.processCreatorInvite,
  resolveBrandForSession: mocks.resolveBrandForSession,
}));

vi.mock('$lib/server/marketplace/instagramScrape', () => ({
  scrapeInstagram: vi.fn(),
}));

vi.mock('$lib/server/marketplace/sheetParser', () => ({
  parseAndValidate: mocks.parseAndValidate,
}));

describe('creator roster bulk upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabaseClient = createSupabaseMock();
    mocks.assertBrandAccess.mockReturnValue('ig-current');
    mocks.resolveBrandForSession.mockResolvedValue({
      brandId: 'brand-current',
      brandName: 'Current Brand',
      brandUsername: 'currentbrand',
      brandIdentity: null,
    });
    mocks.parseAndValidate.mockReturnValue({
      valid: [{ row: 2, handle: 'sharedcreator', custom_fields: {} }],
      errors: [],
      skipped_no_handle: 0,
      duplicates_in_file: 0,
      total_rows: 1,
    });
    mocks.processCreatorInvite.mockResolvedValue({
      entry: { id: 'entry-1' },
      profile: { handle: 'sharedcreator' },
      analysis: { fitLabel: 'Good fit', fitScore: 72 },
    });
  });

  it('only skips existing handles from the authenticated brand roster', async () => {
    const { POST } = await import('../src/routes/api/brand/creator-roster/bulk/+server');
    const formData = new FormData();
    formData.append('file', new File(['instagram\nsharedcreator\n'], 'creators.csv'));

    const response = await POST({ request: new Request('https://app.test/bulk', {
      method: 'POST',
      body: formData,
    }) } as never);
    const body = await response.text();

    expect(mocks.resolveBrandForSession).toHaveBeenCalledWith(
      mocks.supabaseClient,
      'ig-current',
      'Brand',
    );
    expect(mocks.supabaseClient?.queries[0].eq).toHaveBeenCalledWith('brand_id', 'brand-current');
    expect(mocks.processCreatorInvite).toHaveBeenCalledWith(
      mocks.supabaseClient,
      'ig-current',
      'sharedcreator',
      expect.any(Function),
    );
    expect(body).toContain('"valid_count":1');
    expect(body).toContain('"already_in_roster":0');
    expect(body).toContain('"succeeded":1');
  });
});
