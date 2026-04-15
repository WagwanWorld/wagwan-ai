/**
 * POST /api/brand/match-agent
 *
 * SSE streaming endpoint for the brand matching conversation.
 * Brand sends messages, agent responds with questions or results.
 * Uses 3 tools: extract_brand_brief, run_creator_match, generate_outreach_brief.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import {
  BRAND_MATCH_SYSTEM_PROMPT,
  BRAND_MATCH_TOOLS,
  type BrandBrief,
} from '$lib/server/marketplace/brandMatchAgent';
import { loadCreatorPortraits, scoreCreators } from '$lib/server/marketplace/creatorScoring';

export const config = {
  maxDuration: 60,
};

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 55_000 });

type Choice = { label: string; value: string };

function parseChoices(text: string): { cleanText: string; choices: Choice[] | null } {
  const choicesRegex = /```choices\n(\[[\s\S]*?\])\n```/;
  const match = text.match(choicesRegex);
  if (!match) return { cleanText: text, choices: null };

  const cleanText = text.replace(choicesRegex, '').trimEnd();
  try {
    const choices = JSON.parse(match[1]) as Choice[];
    return { cleanText, choices };
  } catch {
    return { cleanText: text, choices: null };
  }
}

export const POST: RequestHandler = async ({ request }) => {
  let body: {
    message: string;
    history?: { role: string; text: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message?.trim()) return json({ ok: false, error: 'empty_message' }, { status: 400 });

  // Build messages array for Claude
  const messages: Anthropic.MessageParam[] = [];

  // Add conversation history
  for (const h of history) {
    messages.push({
      role: h.role === 'agent' ? 'assistant' : 'user',
      content: h.text,
    });
  }

  // Add current message
  messages.push({ role: 'user', content: message });

  // State for tool results
  let extractedBrief: BrandBrief | null = null;

  const encoder = new TextEncoder();
  function sse(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Call Claude with tools
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system: BRAND_MATCH_SYSTEM_PROMPT,
          tools: BRAND_MATCH_TOOLS,
          messages,
        });

        // Process response content blocks
        let agentText = '';

        for (const block of response.content) {
          if (block.type === 'text') {
            const { cleanText, choices } = parseChoices(block.text);
            agentText += cleanText;
            controller.enqueue(sse('text_delta', { delta: cleanText }));
            if (choices) {
              controller.enqueue(sse('choices', { choices }));
            }
          } else if (block.type === 'tool_use') {
            const toolName = block.name;
            const toolInput = block.input as Record<string, unknown>;

            if (toolName === 'extract_brand_brief') {
              extractedBrief = toolInput as unknown as BrandBrief;
              controller.enqueue(sse('status', { step: 'brief', text: 'Understanding your brand...' }));
              controller.enqueue(sse('brief', { brief: extractedBrief }));

              // Continue conversation — Claude needs the tool result to proceed
              const followUp = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 2000,
                system: BRAND_MATCH_SYSTEM_PROMPT,
                tools: BRAND_MATCH_TOOLS,
                messages: [
                  ...messages,
                  { role: 'assistant', content: response.content },
                  { role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: 'Brief extracted successfully. Now summarize it back to the brand for confirmation, then call run_creator_match when they confirm.' }] },
                ],
              });

              for (const fb of followUp.content) {
                if (fb.type === 'text') {
                  const { cleanText, choices } = parseChoices(fb.text);
                  agentText += cleanText;
                  controller.enqueue(sse('text_delta', { delta: cleanText }));
                  if (choices) {
                    controller.enqueue(sse('choices', { choices }));
                  }
                }
              }
            } else if (toolName === 'run_creator_match') {
              controller.enqueue(sse('status', { step: 'scoring', text: 'Analyzing creator signals...' }));
              controller.enqueue(sse('status', { step: 'matching', text: 'Matching to your audience...' }));

              const portraits = await loadCreatorPortraits();
              const limit = (toolInput.limit as number) || 5;
              const results = scoreCreators(portraits, extractedBrief!, limit);

              controller.enqueue(sse('matches', { results }));
              controller.enqueue(sse('status', { step: 'done', text: 'Building your campaign plan...' }));

              // Continue conversation with match results
              const matchSummary = results.matches.map(m =>
                `${m.creator.name} (@${m.creator.handle}) — ${m.creator.follower_count} followers — Score: ${m.score}/100 — ${m.reasoning} — Watch out: ${m.watch_out}`
              ).join('\n\n');

              const followUp = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 2000,
                system: BRAND_MATCH_SYSTEM_PROMPT,
                tools: BRAND_MATCH_TOOLS,
                messages: [
                  ...messages,
                  { role: 'assistant', content: response.content },
                  { role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: `Match results:\n\n${matchSummary}\n\nDisqualified: ${results.disqualified_count} creators. Top reason: ${results.disqualified_reason}.\n\nPresent these results conversationally as specified in your instructions.` }] },
                ],
              });

              for (const fb of followUp.content) {
                if (fb.type === 'text') {
                  const { cleanText, choices } = parseChoices(fb.text);
                  agentText += cleanText;
                  controller.enqueue(sse('text_delta', { delta: cleanText }));
                  if (choices) {
                    controller.enqueue(sse('choices', { choices }));
                  }
                }
              }
            } else if (toolName === 'generate_outreach_brief') {
              const creator = toolInput.creator_name as string;

              controller.enqueue(sse('outreach', { creator_name: creator, generating: true }));

              // Continue with outreach generation
              const followUp = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 500,
                system: BRAND_MATCH_SYSTEM_PROMPT,
                tools: BRAND_MATCH_TOOLS,
                messages: [
                  ...messages,
                  { role: 'assistant', content: response.content },
                  { role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: `Now write the outreach brief for ${creator}. Follow the rules in your instructions exactly.` }] },
                ],
              });

              for (const fb of followUp.content) {
                if (fb.type === 'text') {
                  const { cleanText, choices } = parseChoices(fb.text);
                  agentText += cleanText;
                  controller.enqueue(sse('text_delta', { delta: cleanText }));
                  if (choices) {
                    controller.enqueue(sse('choices', { choices }));
                  }
                }
              }
            }
          }
        }

        controller.enqueue(sse('message', { text: agentText }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[MatchAgent] Error:', msg);
        controller.enqueue(sse('error', { text: 'Something went wrong — please try again.' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
