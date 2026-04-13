/**
 * Applies supabase/*.sql in order over a direct Postgres connection.
 * Set SUPABASE_DB_URL (Supabase → Settings → Database → URI, Transaction pooler recommended).
 * Or run the same files manually in the SQL Editor.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const url = process.env.SUPABASE_DB_URL;
if (!url || url.trim() === '') {
  console.error(
    'Missing SUPABASE_DB_URL. Add it to .env (Postgres URI from Supabase → Settings → Database),\n' +
      'or paste and run these files in order in the SQL Editor:\n' +
      '  supabase/migration.sql\n' +
      '  supabase/002_identity_graph.sql\n' +
      '  supabase/003_multi_agent_chats.sql\n' +
      '  supabase/004_marketplace_mvp.sql\n' +
      '  supabase/005_identity_inference_snapshots.sql\n' +
      '  supabase/006_identity_claims.sql\n' +
      '  supabase/007_wagwan_user_link.sql'
  );
  process.exit(1);
}

const files = [
  'supabase/migration.sql',
  'supabase/002_identity_graph.sql',
  'supabase/003_multi_agent_chats.sql',
  'supabase/004_marketplace_mvp.sql',
  'supabase/005_identity_inference_snapshots.sql',
  'supabase/006_identity_claims.sql',
  'supabase/007_wagwan_user_link.sql',
];

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
});
await client.connect();

try {
  for (const rel of files) {
    const sql = readFileSync(join(root, rel), 'utf8');
    console.error(`Applying ${rel} …`);
    await client.query(sql);
  }
} finally {
  await client.end();
}

console.error('Supabase schema applied successfully.');
