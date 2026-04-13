import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import type { Message } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { extractToolUseInput } from '$lib/server/ai';
import type { ParsedAudience } from './types';

const AUDIENCE_QUERY_TOOL: Tool = {
  name: 'audience_query',
  description:
    'Convert the brand marketing prompt into a structured audience. Omit age_range or use empty array if unknown; use empty string for unknown location.',
  input_schema: {
    type: 'object',
    properties: {
      age_range: {
        type: 'array',
        items: { type: 'number' },
        description: 'Optional [min_age, max_age]; empty if unknown',
      },
      location: { type: 'string', description: 'City or region, or empty' },
      interests: {
        type: 'array',
        items: { type: 'string' },
        description: 'Interest and taste keywords',
      },
      behaviors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Actions, habits, attendance patterns',
      },
      human_summary: {
        type: 'string',
        description: 'One short sentence: who we are looking for, for the brand UI',
      },
    },
    required: ['interests', 'behaviors', 'human_summary'],
  },
};

function normalizeParsed(raw: Record<string, unknown>): ParsedAudience {
  let age_range: [number, number] | null = null;
  const ar = raw.age_range;
  if (Array.isArray(ar) && ar.length >= 2 && typeof ar[0] === 'number' && typeof ar[1] === 'number') {
    age_range = [Math.round(ar[0]), Math.round(ar[1])];
  }
  const loc = raw.location;
  const location =
    loc != null && String(loc).trim() ? String(loc).trim() : null;

  const interests = Array.isArray(raw.interests)
    ? raw.interests.map(x => String(x).trim()).filter(Boolean)
    : [];
  const behaviors = Array.isArray(raw.behaviors)
    ? raw.behaviors.map(x => String(x).trim()).filter(Boolean)
    : [];
  const human_summary =
    typeof raw.human_summary === 'string' && raw.human_summary.trim()
      ? raw.human_summary.trim()
      : 'Audience from your prompt';

  return { age_range, location, interests, behaviors, human_summary };
}

export async function parseAudiencePrompt(prompt: string): Promise<ParsedAudience> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return {
      age_range: null,
      location: null,
      interests: [],
      behaviors: [],
      human_summary: 'Empty prompt',
    };
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 60_000 });
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    tools: [AUDIENCE_QUERY_TOOL],
    tool_choice: { type: 'tool', name: 'audience_query' },
    messages: [
      {
        role: 'user',
        content: `Brand audience description:\n"""${trimmed.slice(0, 4000)}"""\n\nExtract structured audience_query.`,
      },
    ],
  });

  const toolIn = extractToolUseInput<Record<string, unknown>>(res.content as Message['content'], 'audience_query');
  if (toolIn) {
    return normalizeParsed(toolIn);
  }

  // Fallback: light keyword split
  const words = trimmed
    .toLowerCase()
    .split(/[\s,.;]+/)
    .filter(w => w.length > 2)
    .slice(0, 12);
  return {
    age_range: null,
    location: null,
    interests: words,
    behaviors: [],
    human_summary: trimmed.slice(0, 200),
  };
}
