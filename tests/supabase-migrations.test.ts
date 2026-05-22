import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

describe('creator brand signal migrations', () => {
  it('does not grant broad client access to creator signals or brand rosters', () => {
    const migration = readRepoFile('supabase/migrations/20260519000000_creator_brand_signals.sql');

    expect(migration).not.toContain('creator_signals_insert');
    expect(migration).not.toContain('roster_brand_select');
    expect(migration).not.toContain('roster_brand_insert');
    expect(migration).not.toContain('roster_brand_update');
    expect(migration).not.toContain('roster_brand_delete');
  });

  it('drops broad policies for databases that already applied the rollout migration', () => {
    const hardening = readRepoFile(
      'supabase/migrations/20260522000000_harden_creator_brand_signal_rls.sql',
    );

    for (const policy of [
      'creator_signals_insert',
      'roster_brand_select',
      'roster_brand_insert',
      'roster_brand_update',
      'roster_brand_delete',
    ]) {
      expect(hardening).toContain(`DROP POLICY IF EXISTS ${policy}`);
    }
  });

  it('includes the creator roster and signal migrations in the local migration runner', () => {
    const runner = readRepoFile('scripts/apply-supabase-migrations.mjs');

    expect(runner).toContain('supabase/migrations/20260512000000_brand_creator_roster.sql');
    expect(runner).toContain('supabase/migrations/20260519000000_creator_brand_signals.sql');
    expect(runner).toContain('supabase/migrations/20260522000000_harden_creator_brand_signal_rls.sql');
  });
});
