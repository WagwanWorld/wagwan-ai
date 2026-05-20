import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const migrationsDir = join(repoRoot, 'supabase', 'migrations');

function listSqlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return listSqlFiles(fullPath);
    }
    return entry.endsWith('.sql') ? [fullPath] : [];
  });
}

describe('Supabase migrations', () => {
  it('do not include table truncation resets', () => {
    const truncatingMigrations = listSqlFiles(migrationsDir).filter((file) =>
      /\btruncate\s+table\b/i.test(readFileSync(file, 'utf8')),
    );

    expect(truncatingMigrations).toEqual([]);
  });
});
