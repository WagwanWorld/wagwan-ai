import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type PolicyState = Map<string, string>;

function finalPolicyState(): PolicyState {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const policies: PolicyState = new Map();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');

    for (const match of sql.matchAll(/DROP\s+POLICY\s+IF\s+EXISTS\s+(\w+)\s+ON\s+(\w+)/gi)) {
      const [, policyName, tableName] = match;
      policies.delete(`${tableName}.${policyName}`);
    }

    for (const match of sql.matchAll(/CREATE\s+POLICY\s+(\w+)\s+ON\s+(\w+)([\s\S]*?);/gi)) {
      const [, policyName, tableName, definition] = match;
      policies.set(`${tableName}.${policyName}`, definition);
    }
  }

  return policies;
}

describe('creator brand signal RLS migrations', () => {
  it('does not leave public insert or roster CRUD policies active', () => {
    const policies = finalPolicyState();

    expect(policies.has('creator_brand_signals.creator_signals_insert')).toBe(false);
    expect(policies.has('brand_creator_roster.roster_brand_select')).toBe(false);
    expect(policies.has('brand_creator_roster.roster_brand_insert')).toBe(false);
    expect(policies.has('brand_creator_roster.roster_brand_update')).toBe(false);
    expect(policies.has('brand_creator_roster.roster_brand_delete')).toBe(false);
  });
});
