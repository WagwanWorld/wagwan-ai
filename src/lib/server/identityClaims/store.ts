import { getServiceSupabase } from '$lib/server/supabase';
import type { IdentityClaimInsert, IdentityClaimPublic } from './types';
import { embeddingToPgVectorLiteral } from './embeddings';

function rowToPublic(r: Record<string, unknown>): IdentityClaimPublic {
  return {
    id: String(r.id),
    assertion: String(r.assertion),
    domain: (r.domain as string | null) ?? null,
    source: String(r.source),
    confidence: typeof r.confidence === 'number' ? r.confidence : null,
    salience_0_100: typeof r.salience_0_100 === 'number' ? r.salience_0_100 : null,
    claim_kind: String(r.claim_kind),
    payload: (r.payload as Record<string, unknown>) ?? {},
  };
}

/**
 * Replace all claims for a user (full snapshot sync after graph refresh).
 */
export async function replaceUserIdentityClaims(
  googleSub: string,
  claims: IdentityClaimInsert[],
): Promise<boolean> {
  const sb = getServiceSupabase();
  const { error: delErr } = await sb.from('user_identity_claims').delete().eq('user_google_sub', googleSub);
  if (delErr) {
    console.error('[identityClaims/store] delete failed:', delErr.message);
    return false;
  }
  if (!claims.length) return true;

  const seenFp = new Set<string>();
  const deduped = claims.filter(c => {
    if (seenFp.has(c.content_fingerprint)) return false;
    seenFp.add(c.content_fingerprint);
    return true;
  });

  const batchSize = 80;
  for (let i = 0; i < deduped.length; i += batchSize) {
    const chunk = deduped.slice(i, i + batchSize);
    const rows = chunk.map(c => ({
      user_google_sub: c.user_google_sub,
      assertion: c.assertion,
      domain: c.domain,
      source: c.source,
      confidence: c.confidence,
      salience_0_100: c.salience_0_100,
      inference_revision: c.inference_revision,
      claim_kind: c.claim_kind,
      content_fingerprint: c.content_fingerprint,
      payload: c.payload,
      embedding: c.embedding?.length ? embeddingToPgVectorLiteral(c.embedding) : null,
      updated_at: new Date().toISOString(),
    }));
    const { error: insErr } = await sb.from('user_identity_claims').insert(rows);
    if (insErr) {
      console.error('[identityClaims/store] insert failed:', insErr.message);
      return false;
    }
  }
  return true;
}

export async function rpcMatchIdentityClaims(params: {
  googleSub: string;
  queryEmbedding: number[];
  matchCount: number;
}): Promise<IdentityClaimPublic[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb.rpc('match_identity_claims', {
    p_user_google_sub: params.googleSub,
    query_embedding: embeddingToPgVectorLiteral(params.queryEmbedding),
    match_count: params.matchCount,
  });
  if (error) {
    console.error('[identityClaims/store] rpc match failed:', error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map(r => rowToPublic(r as Record<string, unknown>));
}

export async function selectClaimsFiltered(params: {
  googleSub: string;
  domain?: string | null;
  source?: string | null;
  claimKinds?: string[] | null;
  limit: number;
}): Promise<IdentityClaimPublic[]> {
  const sb = getServiceSupabase();
  let q = sb
    .from('user_identity_claims')
    .select(
      'id, assertion, domain, source, confidence, salience_0_100, claim_kind, payload, updated_at',
    )
    .eq('user_google_sub', params.googleSub)
    .order('salience_0_100', { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(params.limit, 1), 100));

  if (params.domain != null && params.domain !== '') {
    q = q.eq('domain', params.domain);
  }
  if (params.source != null && params.source !== '') {
    q = q.eq('source', params.source);
  }
  if (params.claimKinds?.length) {
    q = q.in('claim_kind', params.claimKinds);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[identityClaims/store] select failed:', error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map(r => rowToPublic(r as Record<string, unknown>));
}

/** Token-based fallback when embeddings or RPC are unavailable. */
export async function searchClaimsTextFallback(params: {
  googleSub: string;
  query: string;
  limit: number;
}): Promise<IdentityClaimPublic[]> {
  const tokens = params.query
    .toLowerCase()
    .split(/\s+/g)
    .map(t => t.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(t => t.length > 2)
    .slice(0, 4);
  if (!tokens.length) {
    return selectClaimsFiltered({ googleSub: params.googleSub, limit: params.limit });
  }
  const sb = getServiceSupabase();
  const orFilter = tokens.map(t => `assertion.ilike.%${t}%`).join(',');
  const { data, error } = await sb
    .from('user_identity_claims')
    .select(
      'id, assertion, domain, source, confidence, salience_0_100, claim_kind, payload, updated_at',
    )
    .eq('user_google_sub', params.googleSub)
    .or(orFilter)
    .limit(Math.min(Math.max(params.limit, 1), 48));

  if (error) {
    console.error('[identityClaims/store] text search failed:', error.message);
    return selectClaimsFiltered({ googleSub: params.googleSub, limit: params.limit });
  }
  if (!Array.isArray(data)) return [];
  return data.map(r => rowToPublic(r as Record<string, unknown>));
}
