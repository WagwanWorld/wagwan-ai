import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { extractToolUseInput, type LearnedMemory } from '$lib/server/ai';
import { getIdentityGraph } from '$lib/server/supabase';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import type { AgentType } from '$lib/chats/agentConstants';
import type { MessageRow } from '$lib/server/chatStore';
import { buildAgentSystemPrompt } from './prompts';
import { buildCalendarContext, buildGmailContext } from './googleContext';
import { buildInstagramAgentContext } from '$lib/server/instagramInsights';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 90_000 });

const AGENT_REPLY_TOOL = {
  name: 'wagwan_agent_reply',
  description:
    'Return the visible chat reply. Use message_type insight or recommendation when surfacing findings; alert for time-sensitive items.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Main text shown in the chat (max ~3 short paragraphs).',
      },
      message_type: {
        type: 'string',
        enum: ['text', 'insight', 'alert', 'recommendation', 'action'],
      },
      hook: { type: 'string', description: 'One line: why this matters.' },
      insight: { type: 'string', description: 'What we noticed (fact).'},
      actions: {
        type: 'array',
        items: { type: 'string' },
        description: '1–3 short actionable labels (e.g. "Draft reply to Alex").',
      },
    },
    required: ['message', 'message_type'],
  },
} as const;

function formatHistory(messages: MessageRow[]): string {
  return messages
    .filter(m => m.content?.trim())
    .map(m => {
      const who = m.sender_type === 'user' ? 'User' : m.sender_type === 'system' ? 'System' : 'Agent';
      return `${who}: ${m.content.slice(0, 2000)}`;
    })
    .join('\n\n');
}

async function toolsContextFor(
  agent: AgentType,
  googleSub: string,
  twinProfileSnippet?: string,
): Promise<string> {
  switch (agent) {
    case 'gmail':
      return await buildGmailContext(googleSub);
    case 'calendar':
      return await buildCalendarContext(googleSub);
    case 'instagram':
      return await buildInstagramAgentContext(googleSub);
    case 'culture':
      return `Culture: use identity + city from profile context. Profile snapshot:\n${(twinProfileSnippet ?? '(none)').slice(0, 4000)}`;
    case 'twin':
    default:
      return `Twin: synthesize from shared identity + this profile snapshot:\n${(twinProfileSnippet ?? '(minimal profile)').slice(0, 6000)}`;
  }
}

export interface AgentTurnResult {
  content: string;
  message_type: string;
  metadata: Record<string, unknown>;
}

function compactProfileSnippet(profile: Record<string, unknown> | undefined): string {
  if (!profile || typeof profile !== 'object') return '';
  const city = profile.city;
  const interests = profile.interests;
  const ig = profile.instagramIdentity as { username?: string; aesthetic?: string } | undefined;
  const lines: string[] = [];
  if (typeof city === 'string') lines.push(`City: ${city}`);
  if (Array.isArray(interests)) lines.push(`Interests: ${interests.slice(0, 8).join(', ')}`);
  if (ig?.username) lines.push(`IG: @${ig.username} (${ig.aesthetic ?? ''})`);
  try {
    const raw = JSON.stringify(profile);
    if (raw.length < 8000) return raw;
  } catch {
    /* fall through */
  }
  return lines.join('\n') || '(profile present)';
}

export async function runAgentTurn(params: {
  agent: AgentType;
  googleSub: string;
  userMessage: string;
  priorMessages: MessageRow[];
  twinMemory?: LearnedMemory;
  profile?: Record<string, unknown>;
}): Promise<AgentTurnResult> {
  const profileBody =
    params.profile && typeof params.profile === 'object' && Object.keys(params.profile).length > 0
      ? params.profile
      : null;
  const identitySummary = profileBody
    ? (await resolveIdentityGraph(params.googleSub, profileBody)).summary
    : (await getIdentityGraph(params.googleSub))?.summary ?? '';

  let memoryHint = '';
  if (params.twinMemory && (params.twinMemory.facts?.length || Object.keys(params.twinMemory.preferences ?? {}).length)) {
    memoryHint = `\nLearned preferences: ${JSON.stringify({
      facts: params.twinMemory.facts?.slice(0, 8),
      preferences: params.twinMemory.preferences,
    }).slice(0, 800)}`;
  }

  const twinSnippet =
    params.agent === 'twin' || params.agent === 'culture'
      ? compactProfileSnippet(params.profile)
      : undefined;

  const toolsContext =
    (await toolsContextFor(params.agent, params.googleSub, twinSnippet)) + memoryHint;
  const historyBlock = formatHistory(params.priorMessages.slice(-16));

  const system = buildAgentSystemPrompt(params.agent, {
    identitySummary,
    toolsContext,
    historyBlock,
  });

  const userContent = `User message:\n"""${params.userMessage.replace(/"""/g, '"').slice(0, 8000)}"""\n\nCall wagwan_agent_reply.`;

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system,
    tools: [AGENT_REPLY_TOOL],
    tool_choice: { type: 'tool', name: AGENT_REPLY_TOOL.name },
    messages: [{ role: 'user', content: userContent }],
  });

  const toolIn = extractToolUseInput<{
    message?: string;
    message_type?: string;
    hook?: string;
    insight?: string;
    actions?: string[];
  }>(res.content, AGENT_REPLY_TOOL.name);

  if (!toolIn) {
    const textBlock = res.content.find(b => b.type === 'text');
    const fallback =
      textBlock?.type === 'text' ? textBlock.text?.trim() : '';
    if (fallback) {
      return {
        content: fallback.slice(0, 8000),
        message_type: 'text',
        metadata: {},
      };
    }
    return {
      content:
        'Something went wrong formatting the reply. Please try sending your message again.',
      message_type: 'text',
      metadata: {},
    };
  }

  const message = (toolIn.message ?? '…').trim() || '…';
  const message_type = toolIn.message_type ?? 'text';
  const hook = (toolIn.hook ?? '').trim();
  const insight = (toolIn.insight ?? '').trim();
  const actions = Array.isArray(toolIn.actions) ? toolIn.actions.filter(a => typeof a === 'string').slice(0, 5) : [];

  const metadata: Record<string, unknown> = {};
  if (hook) metadata.hook = hook;
  if (insight) metadata.insight = insight;
  if (actions.length) metadata.actions = actions;

  return {
    content: message,
    message_type,
    metadata,
  };
}
