import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  supabase: null as ReturnType<typeof createSupabaseMock> | null,
  assertBrandAccess: vi.fn(() => 'brand-ig-1'),
  parseAndValidate: vi.fn(),
  processCreatorInvite: vi.fn(),
  resolveBrandForSession: vi.fn(),
  scrapeInstagram: vi.fn(),
}));

function createSupabaseMock(options: {
  existingWithoutBrandScope?: Array<{ ig_username: string }>;
  existingWithBrandScope?: Array<{ ig_username: string }>;
  metadataUpdateResult?: { data: { id: string } | null; error: { message: string } | null };
}) {
  const state = {
    duplicateEqBrand: null as string | null,
    updateEqBrand: null as string | null,
  };

  return {
    state,
    from: vi.fn((table: string) => {
      expect(table).toBe('brand_creator_roster');
      return {
        select: vi.fn(() => ({
          eq: vi.fn((field: string, value: string) => {
            if (field === 'brand_id') state.duplicateEqBrand = value;
            return {
              in: vi.fn(async () => ({
                data: state.duplicateEqBrand
                  ? (options.existingWithBrandScope ?? [])
                  : (options.existingWithoutBrandScope ?? []),
              })),
            };
          }),
          in: vi.fn(async () => ({
            data: options.existingWithoutBrandScope ?? [],
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn((field: string, value: string) => {
            if (field === 'brand_id') state.updateEqBrand = value;
            const chain = {
              eq: vi.fn((nextField: string, nextValue: string) => {
                if (nextField === 'brand_id') state.updateEqBrand = nextValue;
                return chain;
              }),
              select: vi.fn(() => ({
                maybeSingle: vi.fn(
                  async () =>
                    options.metadataUpdateResult ?? { data: { id: 'roster-1' }, error: null },
                ),
              })),
            };
            return chain;
          }),
        })),
      };
    }),
  };
}

vi.mock('$lib/server/supabase', () => ({
  isSupabaseConfigured: () => true,
  getServiceSupabase: () => mocks.supabase,
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
  scrapeInstagram: mocks.scrapeInstagram,
}));

async function postBulkCsv() {
  const { POST } = await import('../src/routes/api/brand/creator-roster/bulk/+server');
  const formData = new FormData();
  formData.set('file', new File(['handle\ncreator'], 'creators.csv', { type: 'text/csv' }));

  return POST({
    request: new Request('https://example.com/api', { method: 'POST', body: formData }),
  } as Parameters<typeof POST>[0]);
}

describe('bulk creator roster upload', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.assertBrandAccess.mockReturnValue('brand-ig-1');
    mocks.parseAndValidate.mockReturnValue({
      valid: [
        {
          row: 2,
          handle: 'creator',
          email: 'creator@example.com',
          custom_fields: { manager: 'Asha' },
        },
      ],
      errors: [],
      skipped_no_handle: 0,
      duplicates_in_file: 0,
      total_rows: 1,
    });
    mocks.processCreatorInvite.mockResolvedValue({
      entry: { id: 'roster-1' },
      profile: { handle: 'creator', displayName: 'Creator' },
      analysis: { fitLabel: 'Good fit', fitScore: 72 },
    });
    mocks.resolveBrandForSession.mockResolvedValue({
      brandId: 'brand-1',
      brandName: 'Brand',
      brandUsername: 'brand',
      brandIdentity: null,
    });
    mocks.supabase = createSupabaseMock({
      existingWithoutBrandScope: [{ ig_username: 'creator' }],
      existingWithBrandScope: [],
    });
  });

  it('does not skip a creator just because another brand already has that handle', async () => {
    const response = await postBulkCsv();
    const text = await response.text();

    expect(mocks.supabase?.state.duplicateEqBrand).toBe('brand-1');
    expect(mocks.processCreatorInvite).toHaveBeenCalledWith(
      mocks.supabase,
      'brand-ig-1',
      'creator',
      mocks.scrapeInstagram,
    );
    expect(text).toContain('"status":"success"');
    expect(text).toContain('"already_in_roster":0');
  });

  it('fails the row when uploaded sheet metadata is not persisted', async () => {
    mocks.supabase = createSupabaseMock({
      existingWithBrandScope: [],
      metadataUpdateResult: { data: null, error: { message: 'write failed' } },
    });

    const response = await postBulkCsv();
    const text = await response.text();

    expect(mocks.supabase?.state.updateEqBrand).toBe('brand-1');
    expect(text).toContain('"status":"failed"');
    expect(text).toContain('roster_metadata_update_failed');
    expect(text).toContain('"succeeded":0');
    expect(text).toContain('"failed":1');
  });

  it('fails the row when invite creation does not return a roster entry id', async () => {
    mocks.processCreatorInvite.mockResolvedValueOnce({
      entry: {},
      profile: { handle: 'creator', displayName: 'Creator' },
      analysis: { fitLabel: 'Good fit', fitScore: 72 },
    });

    const response = await postBulkCsv();
    const text = await response.text();

    expect(text).toContain('"status":"failed"');
    expect(text).toContain('roster_metadata_update_failed');
    expect(text).toContain('"succeeded":0');
    expect(text).toContain('"failed":1');
  });
});
