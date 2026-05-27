import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResponse = { data?: unknown; error?: { message: string } | null };

class FakeQuery {
  table: string;
  response: QueryResponse;
  calls: { method: string; args: unknown[] }[] = [];

  constructor(table: string, response: QueryResponse = { data: null, error: null }) {
    this.table = table;
    this.response = response;
  }

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
  }

  update(...args: unknown[]) {
    this.calls.push({ method: 'update', args });
    return this;
  }

  insert(...args: unknown[]) {
    this.calls.push({ method: 'insert', args });
    return Promise.resolve(this.response);
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
  }

  limit(...args: unknown[]) {
    this.calls.push({ method: 'limit', args });
    return this;
  }

  maybeSingle() {
    this.calls.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(this.response);
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

const queries: FakeQuery[] = [];
const responsesByTable = new Map<string, QueryResponse[]>();

vi.mock('../src/lib/server/supabase', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      const response = responsesByTable.get(table)?.shift() ?? { data: null, error: null };
      const query = new FakeQuery(table, response);
      queries.push(query);
      return query;
    },
  }),
}));

describe('creatorMarketplace brief writes', () => {
  beforeEach(() => {
    queries.length = 0;
    responsesByTable.clear();
  });

  it('does not create a brief response when the creator is not targeted', async () => {
    responsesByTable.set('campaign_audience', [{ data: null, error: null }]);

    const { respondToBrief } = await import('../src/lib/server/creatorMarketplace');

    await expect(respondToBrief('creator-sub', 'campaign-id', 'accept')).resolves.toBeNull();
    expect(queries.map((query) => query.table)).toEqual(['campaign_audience']);
  });

  it('only accepts briefs that are still in sent state', async () => {
    responsesByTable.set('campaign_audience', [
      { data: { campaign_id: 'campaign-id' }, error: null },
    ]);
    responsesByTable.set('campaigns', [{ data: { status: 'active' }, error: null }]);
    responsesByTable.set('brief_responses', [
      {
        data: { id: 1, campaign_id: 'campaign-id', user_google_sub: 'creator-sub' },
        error: null,
      },
    ]);

    const { respondToBrief } = await import('../src/lib/server/creatorMarketplace');

    await respondToBrief('creator-sub', 'campaign-id', 'accept');

    const update = queries.find((query) => query.table === 'brief_responses');
    expect(update?.calls).toContainEqual({ method: 'eq', args: ['status', 'sent'] });
  });

  it('requires a live brief before completing and crediting earnings', async () => {
    responsesByTable.set('brief_responses', [{ data: null, error: null }]);

    const { completeBrief } = await import('../src/lib/server/creatorMarketplace');

    await expect(completeBrief('creator-sub', 'campaign-id', 'https://example.com/post')).resolves.toBe(
      false,
    );

    const update = queries.find((query) => query.table === 'brief_responses');
    expect(update?.calls).toContainEqual({ method: 'eq', args: ['status', 'live'] });
    expect(queries.map((query) => query.table)).not.toContain('user_earnings');
  });
});
