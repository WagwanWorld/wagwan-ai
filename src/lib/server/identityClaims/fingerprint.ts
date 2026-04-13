import { createHash } from 'node:crypto';

export function claimFingerprint(parts: {
  domain: string | null;
  source: string;
  claim_kind: string;
  assertion: string;
}): string {
  const norm = parts.assertion.replace(/\s+/g, ' ').trim().slice(0, 2_000);
  const raw = [parts.domain ?? '', parts.source, parts.claim_kind, norm].join('\u001f');
  return createHash('sha256').update(raw).digest('hex');
}
