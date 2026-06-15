import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServiceSupabase: vi.fn(),
}));

vi.mock('../src/lib/server/supabase', () => ({
  getServiceSupabase: mocks.getServiceSupabase,
}));

import { completeBrief, respondToBrief } from '../src/lib/server/creatorMarketplace';

type Operation = {
  table: string;
  kind: 'select' | 'update' | 'insert';
  payload?: unknown;
  filters: Array<{ column: string; value: unknown }>;
  inFilters: Array<{ column: string; values: unknown[] }>;
};

class FakeQuery {
  constructor(
    private readonly db: FakeSupabase,
    private readonly op: Operation,
  ) {}

  select(): this {
    if (this.op.kind !== 'update') this.op.kind = 'select';
    return this;
  }

  update(payload: unknown): this {
    this.op.kind = 'update';
    this.op.payload = payload;
    return this;
  }

  insert(payload: unknown): Promise<{ error: null }> {
    this.op.kind = 'insert';
    this.op.payload = payload;
    return Promise.resolve({ error: null });
  }

  eq(column: string, value: unknown): this {
    this.op.filters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.op.inFilters.push({ column, values });
    return this;
  }

  limit(): this {
    return this;
  }

  maybeSingle(): Promise<{ data: unknown; error: null }> {
    return Promise.resolve(this.db.resolveSingle(this.op));
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.db.resolveMany(this.op)).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  readonly operations: Operation[] = [];

  constructor(
    private readonly opts: {
      audienceMember: boolean;
      briefRow?: Record<string, unknown> | null;
      existingEarnings?: boolean;
    },
  ) {}

  from(table: string): FakeQuery {
    const op: Operation = { table, kind: 'select', filters: [], inFilters: [] };
    this.operations.push(op);
    return new FakeQuery(this, op);
  }

  resolveSingle(op: Operation): { data: unknown; error: null } {
    if (op.table === 'campaign_audience') {
      return { data: this.opts.audienceMember ? { campaign_id: 'campaign-1' } : null, error: null };
    }
    if (op.table === 'brief_responses') {
      return { data: this.opts.briefRow ?? null, error: null };
    }
    if (op.table === 'campaigns') {
      return { data: { reward_inr: 1000, title: 'Launch' }, error: null };
    }
    return { data: null, error: null };
  }

  resolveMany(op: Operation): { data: unknown[]; error: null } {
    if (op.table === 'user_earnings') {
      return { data: this.opts.existingEarnings ? [{ id: 1 }] : [], error: null };
    }
    return { data: [], error: null };
  }
}

describe('creator marketplace brief authorization', () => {
  beforeEach(() => {
    mocks.getServiceSupabase.mockReset();
  });

  it('does not create a brief response for a creator outside campaign_audience', async () => {
    const db = new FakeSupabase({ audienceMember: false });
    mocks.getServiceSupabase.mockReturnValue(db);

    await expect(respondToBrief('attacker-sub', 'campaign-1', 'accept')).resolves.toBeNull();
    expect(db.operations.some((op) => op.table === 'brief_responses')).toBe(false);
  });

  it('updates only the seeded audience brief row when accepting', async () => {
    const briefRow = { id: 10, campaign_id: 'campaign-1', user_google_sub: 'creator-sub' };
    const db = new FakeSupabase({ audienceMember: true, briefRow });
    mocks.getServiceSupabase.mockReturnValue(db);

    await expect(respondToBrief('creator-sub', 'campaign-1', 'accept')).resolves.toEqual(briefRow);
    const update = db.operations.find((op) => op.table === 'brief_responses');
    expect(update?.kind).toBe('update');
    expect(update?.filters).toEqual(
      expect.arrayContaining([
        { column: 'campaign_id', value: 'campaign-1' },
        { column: 'user_google_sub', value: 'creator-sub' },
      ]),
    );
    expect(update?.inFilters).toEqual([{ column: 'status', values: ['sent', 'accepted'] }]);
  });

  it('does not complete or credit earnings outside campaign_audience', async () => {
    const db = new FakeSupabase({ audienceMember: false });
    mocks.getServiceSupabase.mockReturnValue(db);

    await expect(
      completeBrief('attacker-sub', 'campaign-1', 'https://instagram.com/p/fake'),
    ).resolves.toBe(false);
    expect(db.operations.some((op) => op.table === 'brief_responses')).toBe(false);
    expect(db.operations.some((op) => op.table === 'user_earnings')).toBe(false);
  });

  it('credits earnings only after an audience brief is live', async () => {
    const db = new FakeSupabase({
      audienceMember: true,
      briefRow: { id: 10 },
      existingEarnings: false,
    });
    mocks.getServiceSupabase.mockReturnValue(db);

    await expect(
      completeBrief('creator-sub', 'campaign-1', 'https://instagram.com/p/real'),
    ).resolves.toBe(true);
    const update = db.operations.find((op) => op.table === 'brief_responses');
    expect(update?.kind).toBe('update');
    expect(update?.filters).toEqual(
      expect.arrayContaining([
        { column: 'campaign_id', value: 'campaign-1' },
        { column: 'user_google_sub', value: 'creator-sub' },
        { column: 'status', value: 'live' },
      ]),
    );
    expect(db.operations.some((op) => op.table === 'user_earnings' && op.kind === 'insert')).toBe(
      true,
    );
  });
});
