/**
 * POST /api/chat/learn
 *
 * Extracts identity facts, preferences, topics, AND identity overrides
 * from a recent conversation transcript. Identity overrides are explicit
 * corrections to the inferred identity graph (e.g., "I hate sushi" overrides
 * a food preference inferred from Instagram).
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 60_000 });

export const POST: RequestHandler = async ({ request }) => {
  let body: {
    messages?: { role: string; text: string }[];
    existingFacts?: string[];
    existingPreferences?: Record<string, string>;
  };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const msgs = body.messages ?? [];
  if (msgs.length < 2) return json({ facts: [], preferences: {}, topics: [], identityOverrides: [] });

  const existing = (body.existingFacts ?? []).slice(0, 50);
  const existingPrefs = body.existingPreferences ?? {};

  const transcript = msgs
    .slice(-20)
    .map(m => `${m.role === 'user' ? 'User' : 'Twin'}: ${String(m.text).slice(0, 1500)}`)
    .join('\n')
    .slice(0, 10000);

  const existingBlock = existing.length
    ? `\nAlready known facts (do NOT repeat these):\n${existing.map(f => `- ${f}`).join('\n')}\n\nAlready known preferences:\n${Object.entries(existingPrefs).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : '';

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `You extract personal identity facts from conversations between a user and their digital twin. Focus on preferences, opinions, tastes, dislikes, habits, and decisions — things that help the twin know the user better over time.

Rules:
- Return ONLY new facts not already in the existing memory
- Each fact should be a short, specific statement (under 15 words)
- Preferences should be key-value pairs (category: preference)
- Topics should be 2-4 word summaries of what was discussed
- identityOverrides: when the user explicitly corrects or states a strong preference that should override inferred identity signals. Each override has a "field" (e.g. foodVibe, musicVibe, aesthetic, travelStyle, city) and a "value" (what the user stated). Only include overrides for clear, explicit statements like "I hate X", "I prefer Y", "I'm not really into Z", "I actually live in W".
- If no new learnings, return empty arrays/objects
- Return valid JSON only, no markdown`,
      messages: [{
        role: 'user',
        content: `${existingBlock}\n\nRecent conversation:\n${transcript}\n\nExtract new identity learnings as JSON:\n{"facts": ["..."], "preferences": {"key": "value"}, "topics": ["..."], "identityOverrides": [{"field": "foodVibe", "value": "hates sushi, prefers Italian"}]}`,
      }],
    });

    const text = res.content[0].type === 'text' ? res.content[0].text : '{}';
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let parsed: {
      facts?: string[];
      preferences?: Record<string, string>;
      topics?: string[];
      identityOverrides?: { field: string; value: string }[];
    };
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const overrides = Array.isArray(parsed.identityOverrides)
      ? parsed.identityOverrides
          .filter(o => o.field && o.value)
          .map(o => ({
            field: o.field.trim(),
            value: o.value.trim(),
            source: 'chat' as const,
            learnedAt: new Date().toISOString(),
          }))
          .slice(0, 5)
      : [];

    return json({
      facts: Array.isArray(parsed.facts) ? parsed.facts.filter((f): f is string => typeof f === 'string' && f.trim().length > 3).slice(0, 8) : [],
      preferences: parsed.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : {},
      topics: Array.isArray(parsed.topics) ? parsed.topics.filter((t): t is string => typeof t === 'string').slice(0, 5) : [],
      identityOverrides: overrides,
    });
  } catch (e) {
    console.error('learn endpoint error:', e);
    throw error(500, 'Learning failed');
  }
};
