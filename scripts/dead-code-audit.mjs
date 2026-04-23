#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const candidates = [
  'src/routes/(app)/ai/+page.svelte',
  'src/routes/(app)/ai/+page.server.ts',
  'src/routes/(app)/chats/+page.svelte',
  'src/routes/(app)/chats/+page.server.ts',
  'src/routes/(app)/chat/[id]/+page.svelte',
  'src/routes/(app)/chat/[id]/+page.server.ts',
  'src/routes/(app)/explore/+page.svelte',
  'src/routes/(app)/explore/+page.ts',
];

function hasReferences(relativePath) {
  try {
    const output = execFileSync('rg', ['-n', '--fixed-strings', relativePath, 'src'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

const existing = candidates.filter((file) => existsSync(file));
const report = existing.map((file) => ({
  file,
  hasReferences: hasReferences(file),
}));

console.log('Dead-code audit report:');
for (const row of report) {
  const status = row.hasReferences ? 'KEEP (has references)' : 'REVIEW (no references)';
  console.log(`- ${row.file}: ${status}`);
}

if (report.every((row) => !row.hasReferences)) {
  console.log('\nNo references were found for audited candidates.');
}
