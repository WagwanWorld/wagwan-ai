import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8').toLowerCase();

describe('supabase safety migrations', () => {
  it('does not drop tables still referenced by application routes', () => {
    const sql = migration('20260509000000_drop_unused_tables.sql');

    expect(sql).not.toMatch(/\bdrop\s+table\b/);
    expect(sql).toContain('referenced tables preserved');
  });

  it('requires an explicit session flag before truncating application data', () => {
    const sql = migration('20260509000001_truncate_all_data.sql');

    expect(sql).toContain('app.allow_truncate_all_data');
    expect(sql).toMatch(/raise\s+exception[\s\S]+refusing to truncate application data/);
  });

  it('does not grant public insert or roster access in creator brand signals RLS', () => {
    const sql = migration('20260519000000_creator_brand_signals.sql');

    expect(sql).not.toMatch(/for\s+insert\s+with\s+check\s*\(\s*true\s*\)/);
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/);
    expect(sql).not.toMatch(/with\s+check\s*\(\s*true\s*\)/);
    expect(sql).toContain('drop policy if exists roster_brand_select');
  });
});
