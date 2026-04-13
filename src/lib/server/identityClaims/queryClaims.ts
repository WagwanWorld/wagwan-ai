import { embedTexts } from './embeddings';
import {
  rpcMatchIdentityClaims,
  searchClaimsTextFallback,
  selectClaimsFiltered,
} from './store';
import type { IdentityClaimPublic } from './types';

export async function searchIdentityClaimsSemantic(
  googleSub: string,
  query: string,
  limit = 12,
): Promise<IdentityClaimPublic[]> {
  const q = query.replace(/\s+/g, ' ').trim();
  if (!googleSub.trim() || !q) return [];

  const emb = await embedTexts([q]);
  if (emb?.[0]?.length) {
    const matched = await rpcMatchIdentityClaims({
      googleSub: googleSub.trim(),
      queryEmbedding: emb[0],
      matchCount: limit,
    });
    if (matched.length) return matched;
  }
  return searchClaimsTextFallback({ googleSub: googleSub.trim(), query: q, limit });
}

export async function searchIdentityClaimsStructured(params: {
  googleSub: string;
  domain?: string | null;
  source?: string | null;
  claimKinds?: string[] | null;
  limit?: number;
}): Promise<IdentityClaimPublic[]> {
  if (!params.googleSub.trim()) return [];
  return selectClaimsFiltered({
    googleSub: params.googleSub.trim(),
    domain: params.domain,
    source: params.source,
    claimKinds: params.claimKinds ?? null,
    limit: params.limit ?? 24,
  });
}

export async function rollupIdentityDomain(
  googleSub: string,
  domain: string,
  limit = 20,
): Promise<string> {
  const rows = await selectClaimsFiltered({
    googleSub: googleSub.trim(),
    domain: domain.trim() || null,
    limit,
  });
  if (!rows.length) return '';
  return rows.map(r => `• ${r.assertion}`).join('\n');
}

/** For chat/search: compact block to inject into prompts. */
export async function retrieveClaimsForUserTask(
  googleSub: string | undefined | null,
  taskText: string,
  limit =10,
): Promise<string> {
  if (!googleSub?.trim() || !taskText.trim()) return '';
  const rows = await searchIdentityClaimsSemantic(googleSub.trim(), taskText, limit);
  if (!rows.length) return '';
  const lines = rows.map(
    r =>
      `- [${r.domain ?? 'general'}|${r.source}|${r.claim_kind}] ${r.assertion}`,
  );
  return `Identity memory (retrieved for this task):\n${lines.join('\n')}\n`;
}
