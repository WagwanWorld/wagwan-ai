import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { rollupIdentityDomain, searchIdentityClaimsSemantic, searchIdentityClaimsStructured } from './queryClaims';

export const IDENTITY_SEARCH_SEMANTIC_TOOL: Tool = {
  name: 'identity_search_semantic',
  description:
    'Search this user’s persisted identity claims by meaning (embeddings + text fallback). Use for fuzzy, question-like lookups.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural-language query or keywords.' },
      limit: { type: 'number', description: 'Max claims to return (default 10).' },
    },
    required: ['query'],
  },
};

export const IDENTITY_FILTER_STRUCTURED_TOOL: Tool = {
  name: 'identity_filter_structured',
  description:
    'Filter identity claims by domain (e.g. music, career_work), data source (spotify, instagram), and/or claim kind.',
  input_schema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description:
          'Life domain id: music, shopping_style, career_work, sports_fitness, social_creator, travel_food, wellness, tech_media',
      },
      source: {
        type: 'string',
        description:
          'Evidence source: instagram, spotify, apple_music, youtube, google, linkedin, manual, inferred_cross',
      },
      claim_kinds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: evidence, narrative, signal, prediction, graph_fact, intent, interest, need, trajectory',
      },
      limit: { type: 'number' },
    },
    required: [],
  },
};

export const IDENTITY_DOMAIN_ROLLUP_TOOL: Tool = {
  name: 'identity_domain_summary',
  description:
    'Summarise all stored claims for one life domain as a bullet list (structured retrieval).',
  input_schema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: 'Life domain id (e.g. music, career_work).' },
      limit: { type: 'number' },
    },
    required: ['domain'],
  },
};

export const IDENTITY_MEMORY_TOOLS: Tool[] = [
  IDENTITY_SEARCH_SEMANTIC_TOOL,
  IDENTITY_FILTER_STRUCTURED_TOOL,
  IDENTITY_DOMAIN_ROLLUP_TOOL,
];

export type IdentityToolName = (typeof IDENTITY_MEMORY_TOOLS)[number]['name'];

export async function executeIdentityMemoryTool(
  name: string,
  input: Record<string, unknown>,
  googleSub: string | undefined | null,
): Promise<{ content: string; isError?: boolean }> {
  if (!googleSub?.trim()) {
    return { content: JSON.stringify({ error: 'no_user', message: 'Identity memory unavailable for this session.' }) };
  }
  const sub = googleSub.trim();
  try {
    if (name === 'identity_search_semantic') {
      const query = String(input.query ?? '');
      const limit = typeof input.limit === 'number' ? Math.min(24, Math.max(1, input.limit)) : 10;
      const rows = await searchIdentityClaimsSemantic(sub, query, limit);
      return {
        content: JSON.stringify({
          claims: rows.map(r => ({
            assertion: r.assertion,
            domain: r.domain,
            source: r.source,
            kind: r.claim_kind,
            confidence: r.confidence,
            salience: r.salience_0_100,
          })),
        }),
      };
    }
    if (name === 'identity_filter_structured') {
      const domain = input.domain != null ? String(input.domain).trim() || null : null;
      const source = input.source != null ? String(input.source).trim() || null : null;
      const claimKinds = Array.isArray(input.claim_kinds)
        ? (input.claim_kinds as unknown[]).map(x => String(x))
        : null;
      const limit = typeof input.limit === 'number' ? Math.min(100, Math.max(1, input.limit)) : 24;
      const rows = await searchIdentityClaimsStructured({
        googleSub: sub,
        domain,
        source,
        claimKinds,
        limit,
      });
      return {
        content: JSON.stringify({
          claims: rows.map(r => ({
            assertion: r.assertion,
            domain: r.domain,
            source: r.source,
            kind: r.claim_kind,
          })),
        }),
      };
    }
    if (name === 'identity_domain_summary') {
      const domain = String(input.domain ?? '').trim();
      if (!domain) {
        return { content: JSON.stringify({ error: 'missing_domain' }), isError: true };
      }
      const limit = typeof input.limit === 'number' ? Math.min(40, Math.max(5, input.limit)) : 20;
      const text = await rollupIdentityDomain(sub, domain, limit);
      return { content: JSON.stringify({ domain, summary: text || '(no claims for this domain yet)' }) };
    }
    return { content: JSON.stringify({ error: 'unknown_tool', name }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: JSON.stringify({ error: 'tool_failed', message: msg }), isError: true };
  }
}
