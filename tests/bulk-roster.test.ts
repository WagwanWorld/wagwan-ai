import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existingRows: [] as Array<{ ig_username: string }>,
  updateError: null as { message: string } | null,
  processCreatorInvite: vi.fn(),
  queryCalls: [] as Array<{ table: string; op: string; args: unknown[] }>,
}));

vi.mock('$lib/server/supabase', () => ({
  isSupabaseConfigured: () => true,
  getServiceSupabase: () => createSupabaseMock(),
}));

vi.mock('$lib/server/marketplace/brandAuth', () => ({
  assertBrandAccess: () => 'ig-brand-user',
}));

vi.mock('$lib/server/marketplace/creatorInvite', () => ({
  resolveBrandForSession: () =>
    Promise.resolve({
      brandId: 'brand-b',
      brandName: 'Brand B',
      brandUsername: 'brandb',
      brandIdentity: null,
    }),
  processCreatorInvite: mocks.processCreatorInvite,
}));

vi.mock('$lib/server/marketplace/instagramScrape', () => ({
  scrapeInstagram: vi.fn(),
}));

vi.mock('$lib/server/marketplace/sheetParser', () => ({
  parseAndValidate: () => ({
    valid: [
      {
        handle: 'taken',
        custom_fields: {},
      },
      {
        handle: 'newcreator',
        email: 'new@example.com',
        custom_fields: {
          manager: 'Anika',
        },
      },
    ],
    errors: [],
    skipped_no_handle: 0,
    duplicates_in_file: 0,
    total_rows: 2,
  }),
}));

function createSupabaseMock() {
  return {
    from(table: string) {
      return createQuery(table);
    },
  };
}

function createQuery(table: string) {
  let operation = 'select';

  const query = {
    select(...args: unknown[]) {
      operation = 'select';
      mocks.queryCalls.push({ table, op: 'select', args });
      return query;
    },
    update(...args: unknown[]) {
      operation = 'update';
      mocks.queryCalls.push({ table, op: 'update', args });
      return query;
    },
    eq(...args: unknown[]) {
      mocks.queryCalls.push({ table, op: 'eq', args });
      return query;
    },
    in(...args: unknown[]) {
      mocks.queryCalls.push({ table, op: 'in', args });
      return query;
    },
    then(resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) {
      const result =
        operation === 'update'
          ? { error: mocks.updateError }
          : { data: mocks.existingRows, error: null };
      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return query;
}

describe('bulk creator roster upload', () => {
  beforeEach(() => {
    mocks.existingRows = [{ ig_username: 'taken' }];
    mocks.updateError = null;
    mocks.queryCalls = [];
    mocks.processCreatorInvite.mockReset();
    mocks.processCreatorInvite.mockResolvedValue({
      entry: { id: 'entry-new' },
      profile: {
        handle: 'newcreator',
        displayName: 'New Creator',
      },
      analysis: {
        fitLabel: 'Good fit',
        fitScore: 68,
      },
    });
  });

  it('scopes duplicate checks and metadata updates to the authenticated brand', async () => {
    const { POST } = await import('../src/routes/api/brand/creator-roster/bulk/+server');
    const formData = new FormData();
    formData.set('file', new File(['handle\nnewcreator'], 'creators.csv', { type: 'text/csv' }));

    const response = await POST({
      request: new Request('https://example.com', {
        method: 'POST',
        body: formData,
      }),
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('"already_in_roster":1');
    expect(body).toContain('"succeeded":1');
    expect(mocks.processCreatorInvite).toHaveBeenCalledTimes(1);
    expect(mocks.processCreatorInvite).toHaveBeenCalledWith(
      expect.anything(),
      'ig-brand-user',
      'newcreator',
      expect.any(Function),
    );

    const rosterEqCalls = mocks.queryCalls.filter(
      (call) => call.table === 'brand_creator_roster' && call.op === 'eq',
    );
    expect(rosterEqCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ args: ['brand_id', 'brand-b'] }),
        expect.objectContaining({ args: ['id', 'entry-new'] }),
      ]),
    );
    expect(
      mocks.queryCalls.find(
        (call) =>
          call.table === 'brand_creator_roster' &&
          call.op === 'update' &&
          JSON.stringify(call.args[0]).includes('new@example.com') &&
          JSON.stringify(call.args[0]).includes('Anika'),
      ),
    ).toBeTruthy();
  });

  it('fails the row when sheet metadata cannot be persisted', async () => {
    mocks.updateError = { message: 'write failed' };

    const { POST } = await import('../src/routes/api/brand/creator-roster/bulk/+server');
    const formData = new FormData();
    formData.set('file', new File(['handle\nnewcreator'], 'creators.csv', { type: 'text/csv' }));

    const response = await POST({
      request: new Request('https://example.com', {
        method: 'POST',
        body: formData,
      }),
    } as Parameters<typeof POST>[0]);

    const body = await response.text();
    expect(body).toContain('"status":"failed"');
    expect(body).toContain('sheet_metadata_update_failed');
    expect(body).toContain('"succeeded":0');
    expect(body).toContain('"failed":1');
  });
});
