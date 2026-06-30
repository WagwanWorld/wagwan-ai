import { describe, expect, it, vi } from 'vitest';

const processCreatorInvite = vi.fn();

interface QueryRecord {
  table: string;
  selected?: string;
  eq: Array<{ column: string; value: unknown }>;
  in: Array<{ column: string; values: unknown[] }>;
}

const queries: QueryRecord[] = [];

function makeQuery(table: string, result: unknown) {
  const record: QueryRecord = { table, eq: [], in: [] };
  queries.push(record);

  const query = {
    select(columns: string) {
      record.selected = columns;
      return query;
    },
    eq(column: string, value: unknown) {
      record.eq.push({ column, value });
      return query;
    },
    in(column: string, values: unknown[]) {
      record.in.push({ column, values });
      return query;
    },
    maybeSingle() {
      return Promise.resolve({ data: result, error: null });
    },
    then(resolve: (value: { data: unknown; error: null }) => void) {
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
  };

  return query;
}

vi.mock('$lib/server/supabase', () => ({
  isSupabaseConfigured: () => true,
  getServiceSupabase: () => ({
    from(table: string) {
      if (table === 'brand_accounts') {
        return makeQuery(table, {
          brand_id: 'brand-b',
          ig_username: 'brandb',
          ig_name: 'Brand B',
          brand_identity: null,
        });
      }

      if (table === 'brand_creator_roster') {
        return makeQuery(table, []);
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

vi.mock('$lib/server/marketplace/brandAuth', () => ({
  assertBrandAccess: () => 'brand-session-b',
}));

vi.mock('$lib/server/marketplace/sheetParser', () => ({
  parseAndValidate: () => ({
    valid: [
      {
        handle: 'creatorx',
        custom_fields: {},
      },
    ],
    errors: [],
    skipped_no_handle: 0,
    duplicates_in_file: 0,
    total_rows: 1,
  }),
}));

vi.mock('$lib/server/marketplace/creatorInvite', () => ({
  resolveBrandForSession: async () => ({
    brandId: 'brand-b',
    brandName: 'Brand B',
    brandUsername: 'brandb',
    brandIdentity: null,
  }),
  processCreatorInvite,
}));

vi.mock('$lib/server/marketplace/instagramScrape', () => ({
  scrapeInstagram: vi.fn(),
}));

describe('POST /api/brand/creator-roster/bulk', () => {
  it('checks existing roster handles only within the active brand', async () => {
    processCreatorInvite.mockResolvedValueOnce({
      entry: {},
      profile: {},
      analysis: { fitLabel: 'Good fit', fitScore: 72 },
    });
    queries.length = 0;

    const { POST } = await import('../src/routes/api/brand/creator-roster/bulk/+server');
    const form = new FormData();
    form.set('file', new File(['handle\ncreatorx\n'], 'creators.csv', { type: 'text/csv' }));

    const response = await POST({ request: new Request('https://example.com', { method: 'POST', body: form }) } as never);
    const body = await response.text();

    expect(body).toContain('event: validated');
    expect(body).toContain('"valid_count":1');
    expect(body).toContain('"already_in_roster":0');
    expect(processCreatorInvite).toHaveBeenCalledWith(
      expect.anything(),
      'brand-session-b',
      'creatorx',
      expect.any(Function),
    );

    const rosterQuery = queries.find(
      (query) => query.table === 'brand_creator_roster' && query.selected === 'ig_username',
    );
    expect(rosterQuery?.eq).toContainEqual({ column: 'brand_id', value: 'brand-b' });
    expect(rosterQuery?.in).toContainEqual({ column: 'ig_username', values: ['creatorx'] });
  });
});
