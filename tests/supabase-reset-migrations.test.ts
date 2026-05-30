import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('manual reset SQL safety', () => {
  it('keeps reset scripts non-destructive in supabase migrations', () => {
    const resetMigrationFiles = [
      'supabase/migrations/20260509000000_drop_unused_tables.sql',
      'supabase/migrations/20260509000001_truncate_all_data.sql',
    ];

    for (const file of resetMigrationFiles) {
      const sql = readFileSync(join(root, file), 'utf8');
      const executableSql = sql
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n');
      expect(executableSql).not.toMatch(/\bdrop\s+table\b/i);
      expect(executableSql).not.toMatch(/\btruncate\s+table\b/i);
    }
  });
});
