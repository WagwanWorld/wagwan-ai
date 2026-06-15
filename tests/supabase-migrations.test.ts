import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Supabase migration runner', () => {
  it('includes the signed agreements schema migration', () => {
    const runner = readFileSync('scripts/apply-supabase-migrations.mjs', 'utf8');
    const migration = readFileSync(
      'supabase/migrations/20260531000000_signed_agreements.sql',
      'utf8',
    );

    expect(runner).toContain('supabase/migrations/20260531000000_signed_agreements.sql');
    expect(migration).toContain(
      'drop policy if exists "Service role full access on signed_agreements"',
    );
  });
});
