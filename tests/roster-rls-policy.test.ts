import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

describe('brand creator roster RLS migrations', () => {
  it('does not add public brand_creator_roster policies', () => {
    const policyCreations = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .flatMap((file) => {
        const sql = readFileSync(join(migrationsDir, file), 'utf8');
        const matches = sql.match(/CREATE\s+POLICY[\s\S]*?ON\s+brand_creator_roster\b[\s\S]*?;/gi);
        return (matches ?? []).map((statement) => ({ file, statement }));
      });

    expect(policyCreations).toEqual([]);
  });

  it('does not allow public creator brand signal inserts', () => {
    const publicInsertPolicies = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .flatMap((file) => {
        const sql = readFileSync(join(migrationsDir, file), 'utf8');
        const matches = sql.match(
          /CREATE\s+POLICY[\s\S]*?ON\s+creator_brand_signals\b[\s\S]*?FOR\s+INSERT[\s\S]*?WITH\s+CHECK\s*\(\s*true\s*\)[\s\S]*?;/gi,
        );
        return (matches ?? []).map((statement) => ({ file, statement }));
      });

    expect(publicInsertPolicies).toEqual([]);
  });

  it('drops previously shipped permissive roster policies', () => {
    const sql = readFileSync(
      join(migrationsDir, '20260613000000_lock_down_brand_creator_roster_policies.sql'),
      'utf8',
    );

    for (const policyName of [
      'roster_brand_select',
      'roster_brand_insert',
      'roster_brand_update',
      'roster_brand_delete',
    ]) {
      expect(sql).toMatch(new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${policyName}`, 'i'));
    }

    expect(sql).toMatch(/DROP\s+POLICY\s+IF\s+EXISTS\s+creator_signals_insert/i);
  });
});
