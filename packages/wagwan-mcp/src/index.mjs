#!/usr/bin/env node
/**
 * Wagwan MCP server — exposes identity / behavioral data via tools (stdio).
 *
 * Environment:
 *   WAGWAN_API_BASE  — e.g. https://app.example.com (no trailing slash)
 *   WAGWAN_SERVICE_TOKEN — optional Bearer token if your deployment requires it
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const base = (process.env.WAGWAN_API_BASE ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const token = process.env.WAGWAN_SERVICE_TOKEN ?? '';

async function wagwanFetch(path) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const server = new McpServer({ name: 'wagwan-identity', version: '0.1.0' });

server.registerTool(
  'get_behavioral_profile',
  {
    description:
      'Read Wagwan persona API: inference, hyper inference, signal highlights, memory graph projection.',
    inputSchema: z.object({
      sub: z.string().describe('Google OIDC subject (`sub`) for the user profile'),
    }),
  },
  async ({ sub }) => {
    const j = await wagwanFetch(`/api/user/persona?sub=${encodeURIComponent(sub)}`);
    return {
      content: [{ type: 'text', text: JSON.stringify(j, null, 2) }],
    };
  },
);

server.registerTool(
  'get_memory_graph',
  {
    description: 'Return only the memoryGraph projection from the persona payload.',
    inputSchema: z.object({
      sub: z.string().describe('Google OIDC subject (`sub`)'),
    }),
  },
  async ({ sub }) => {
    const j = await wagwanFetch(`/api/user/persona?sub=${encodeURIComponent(sub)}`);
    const mg = j?.memoryGraph ?? null;
    return {
      content: [{ type: 'text', text: JSON.stringify(mg, null, 2) }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
