/**
 * Proactive agent inserts (cron / worker). Protect with x-wagwan-trigger-secret.
 */
import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { isSupabaseConfigured } from '$lib/server/supabase';
import {
  appendMessage,
  countProactiveMessagesToday,
  ensureChat,
  type AgentType,
} from '$lib/server/chatStore';
import { isAgentType } from '$lib/chats/agentConstants';
import {
  buildGmailContext,
  resolveGoogleAccessToken,
} from '$lib/server/agents/googleContext';
import { fetchCalendarEvents } from '$lib/server/google';

const MAX_PROACTIVE_PER_DAY = 5;

function assertTriggerAuth(request: Request) {
  const configured = (env.AGENT_TRIGGER_SECRET ?? '').trim();
  if (!configured) {
    if (!dev) throw error(503, 'AGENT_TRIGGER_SECRET not configured');
    return;
  }
  const h = request.headers.get('x-wagwan-trigger-secret')?.trim() ?? '';
  if (h !== configured) throw error(401, 'Unauthorized');
}

function eventStartMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export const POST: RequestHandler = async ({ request }) => {
  assertTriggerAuth(request);

  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: { googleSub?: string; agent?: AgentType; event?: string; payload?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'invalid json');
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  const agentRaw = body.agent;
  const event = typeof body.event === 'string' ? body.event.trim() : '';
  if (!googleSub || !agentRaw || !event) throw error(400, 'googleSub, agent, event required');
  if (!isAgentType(String(agentRaw))) throw error(400, 'invalid agent');
  const agent = agentRaw as AgentType;

  const todayCount = await countProactiveMessagesToday(googleSub);
  if (todayCount >= MAX_PROACTIVE_PER_DAY) {
    return json({ ok: true, skipped: 'daily_cap', count: todayCount });
  }

  const chat = await ensureChat(googleSub, agent);
  if (!chat) return json({ ok: false, error: 'chat_unavailable' }, { status: 500 });

  if (event === 'new_email' && agent === 'gmail') {
    const ctx = await buildGmailContext(googleSub);
    if (ctx.includes('not connected') || ctx.includes('no recent') || ctx.includes('could not fetch')) {
      return json({ ok: true, skipped: 'no_signal', reason: ctx.slice(0, 120) });
    }
    await appendMessage(chat.id, googleSub, {
      sender_type: 'agent',
      content: 'You have fresh inbox activity — want a 20-second readout or drafts for replies?',
      message_type: 'insight',
      metadata: {
        hook: 'New email activity',
        insight: ctx.slice(0, 900),
        actions: ['Summarise my inbox', 'What needs a reply?'],
        proactive: true,
      },
    });
    return json({ ok: true, inserted: 'gmail_new_email' });
  }

  if (event === 'calendar_soon' && agent === 'calendar') {
    const token = await resolveGoogleAccessToken(googleSub);
    if (!token) return json({ ok: true, skipped: 'no_calendar' });
    let events;
    try {
      events = await fetchCalendarEvents(token, 1);
    } catch {
      return json({ ok: true, skipped: 'calendar_fetch_failed' });
    }
    const now = Date.now();
    let pick: { title: string; start: string; minutes: number; location?: string } | null = null;
    for (const e of events) {
      const start = eventStartMs(e.start);
      if (!Number.isFinite(start)) continue;
      const min = (start - now) / 60_000;
      if (min >= 8 && min <= 40) {
        pick = { title: e.title, start: e.start, minutes: Math.round(min), location: e.location };
        break;
      }
    }
    if (!pick) return json({ ok: true, skipped: 'no_upcoming_window' });

    await appendMessage(chat.id, googleSub, {
      sender_type: 'agent',
      content: `Leave soon: "${pick.title}" starts in ~${pick.minutes} min${pick.location ? ` (${pick.location})` : ''}.`,
      message_type: 'alert',
      metadata: {
        hook: 'Starting soon',
        insight: `${pick.title} @ ${pick.start}`,
        actions: ['Open Calendar', 'What else is on today?'],
        proactive: true,
      },
    });
    return json({ ok: true, inserted: 'calendar_soon' });
  }

  if (event === 'morning_digest') {
    let remaining = MAX_PROACTIVE_PER_DAY - todayCount;
    const inserted: string[] = [];

    if (remaining > 0) {
      const gmail = await ensureChat(googleSub, 'gmail');
      const ctx = await buildGmailContext(googleSub);
      if (
        gmail &&
        !ctx.includes('not connected') &&
        !ctx.includes('no recent') &&
        !ctx.includes('could not fetch')
      ) {
        await appendMessage(gmail.id, googleSub, {
          sender_type: 'agent',
          content: 'Morning — here is a quick inbox pulse. Want a deeper summary?',
          message_type: 'insight',
          metadata: {
            hook: 'Morning digest',
            insight: ctx.slice(0, 700),
            actions: ['Summarise my inbox'],
            proactive: true,
          },
        });
        inserted.push('gmail');
        remaining -= 1;
      }
    }

    if (remaining > 0) {
      const cal = await ensureChat(googleSub, 'calendar');
      const token = await resolveGoogleAccessToken(googleSub);
      if (cal && token) {
        try {
          const evs = await fetchCalendarEvents(token, 1);
          const lines = evs.slice(0, 4).map(e => `• ${e.title} (${e.start})`);
          if (lines.length) {
            await appendMessage(cal.id, googleSub, {
              sender_type: 'agent',
              content: 'Your day ahead (next events):',
              message_type: 'recommendation',
              metadata: {
                hook: 'Today',
                insight: lines.join('\n'),
                actions: ['Plan my day', 'When am I free?'],
                proactive: true,
              },
            });
            inserted.push('calendar');
          }
        } catch {
          /* skip */
        }
      }
    }

    return json({ ok: true, inserted: inserted.length ? inserted : 'none', skipped: inserted.length ? undefined : 'no_signal' });
  }

  return json({ ok: true, skipped: 'unknown_event' });
};
