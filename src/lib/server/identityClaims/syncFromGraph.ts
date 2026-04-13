import type { IdentityGraph } from '$lib/server/identity';
import { isSupabaseConfigured } from '$lib/server/supabase';
import { parseInferenceIdentityWrapper } from '$lib/server/marketplace/inferenceIdentitySchema';
import { embedTexts } from './embeddings';
import { projectIdentityClaims } from './projectClaims';
import { replaceUserIdentityClaims } from './store';

/**
 * Project graph + inference into claim rows, embed assertions, persist (full replace per user).
 * Safe to call after `upsertIdentityGraph`; logs and returns on failure without throwing.
 */
export async function syncIdentityClaimsFromGraph(
  googleSub: string,
  graph: IdentityGraph,
  inferenceIdentityRaw: unknown,
): Promise<void> {
  if (!isSupabaseConfigured() || !googleSub.trim()) return;

  const wrap = parseInferenceIdentityWrapper(inferenceIdentityRaw);
  const rows = projectIdentityClaims(googleSub.trim(), graph, wrap);

  const embeddings = await embedTexts(rows.map(r => r.assertion));
  if (embeddings && embeddings.length === rows.length) {
    for (let i = 0; i < rows.length; i++) {
      rows[i].embedding = embeddings[i];
    }
  }

  const ok = await replaceUserIdentityClaims(googleSub.trim(), rows);
  if (!ok) {
    console.error('[identityClaims/sync] replaceUserIdentityClaims failed for', googleSub.slice(0, 12));
  }
}
