import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function migration(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

describe('migration safety', () => {
  it('keeps reset placeholders non-destructive', () => {
    const resetMigrations = [
      'supabase/migrations/20260509000000_drop_unused_tables.sql',
      'supabase/migrations/20260509000001_truncate_all_data.sql',
    ];

    for (const path of resetMigrations) {
      const sql = migration(path);
      expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    }
  });

  it('does not expose new service-owned tables with unrestricted RLS policies', () => {
    const rlsMigrations = [
      'supabase/migrations/20260511000000_follower_analytics.sql',
      'supabase/migrations/20260519000000_creator_brand_signals.sql',
    ];

    for (const path of rlsMigrations) {
      const sql = migration(path);
      const policies = sql
        .split(';')
        .map((statement) => statement.trim())
        .filter((statement) => /^CREATE\s+POLICY\b/i.test(statement));

      for (const policy of policies) {
        const allowsAllRows = /USING\s*\(\s*true\s*\)/i.test(policy);
        const allowsAllWrites = /WITH\s+CHECK\s*\(\s*true\s*\)/i.test(policy);
        const serviceRoleOnly = /\bTO\s+service_role\b/i.test(policy);

        expect(allowsAllRows && !serviceRoleOnly).toBe(false);
        expect(allowsAllWrites && !serviceRoleOnly).toBe(false);
      }
    }
  });
});
