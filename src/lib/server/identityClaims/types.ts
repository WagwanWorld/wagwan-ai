/** Rows written to `user_identity_claims` (API between projection and Supabase). */

export type IdentityClaimKind =
  | 'evidence'
  | 'narrative'
  | 'signal'
  | 'prediction'
  | 'graph_fact'
  | 'intent'
  | 'interest'
  | 'need'
  | 'trajectory';

export interface IdentityClaimInsert {
  user_google_sub: string;
  assertion: string;
  domain: string | null;
  source: string;
  confidence: number | null;
  salience_0_100: number | null;
  inference_revision: number | null;
  claim_kind: IdentityClaimKind;
  content_fingerprint: string;
  payload: Record<string, unknown>;
  /** Optional embedding vector; stored as pgvector from JSON array via RPC/raw. */
  embedding: number[] | null;
}

export interface IdentityClaimPublic {
  id: string;
  assertion: string;
  domain: string | null;
  source: string;
  confidence: number | null;
  salience_0_100: number | null;
  claim_kind: string;
  payload: Record<string, unknown>;
}
