<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { profile } from '$lib/stores/profile';
  import { loadTwinMemory, memoryKeyForProfile } from '$lib/stores/twinMemory';
  import type { AgentType } from '$lib/chats/agentConstants';
  import {
    readJsonResponse,
    errorMessageFromJson,
    ChatUserBubble,
    ChatSuggestionChips,
    ChatComposerPill,
  } from '$lib/chat';

  export let chatId: string;
  export let agentLabel: string;
  export let agentType: AgentType = 'twin';

  interface Row {
    id: string;
    sender_type: string;
    content: string;
    message_type: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }

  const GMAIL_DAY_SUMMARY_Q =
    "Summarise my inbox for the last 24 hours: what matters, what likely needs a reply, and anything time-sensitive. Be concise; use short bullets.";

  let messages: Row[] = [];
  let inputText = '';
  let busy = false;
  let chatEl: HTMLDivElement;
  let loadError = '';
  let gmailAutoSummaryStarted = false;

  async function loadMessages() {
    const sub = $profile.googleSub;
    if (!sub) return;
    loadError = '';
    try {
      const r = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/messages?sub=${encodeURIComponent(sub)}&markRead=1`,
      );
      const { ok, data, raw } = await readJsonResponse<{ messages?: Row[]; error?: string }>(r);
      if (!data) {
        loadError = raw.slice(0, 160) || 'Invalid server response';
        return;
      }
      if (!ok) {
        loadError =
          typeof data.error === 'string' ? data.error : 'Failed to load messages';
        return;
      }
      messages = (data.messages ?? []) as Row[];
      await scrollBottom();

      if (
        agentType === 'gmail' &&
        messages.length === 0 &&
        !gmailAutoSummaryStarted &&
        !busy
      ) {
        gmailAutoSummaryStarted = true;
        await send(GMAIL_DAY_SUMMARY_Q);
      }
    } catch {
      loadError = 'Network error';
    }
  }

  onMount(() => {
    void loadMessages();
  });

  async function scrollBottom() {
    await tick();
    if (chatEl) chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  }

  async function send(preset?: string) {
    const text = (preset ?? inputText).trim();
    if (!text || busy) return;
    const sub = $profile.googleSub;
    if (!sub) return;

    busy = true;
    if (!preset) inputText = '';
    loadError = '';

    const twinMem = loadTwinMemory(memoryKeyForProfile($profile));
    const twinMemory =
      twinMem.facts.length || Object.keys(twinMem.preferences).length
        ? {
            facts: twinMem.facts,
            preferences: twinMem.preferences,
            recentTopics: twinMem.recentTopics,
          }
        : undefined;

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSub: sub,
          chatId,
          message: text,
          profile: $profile as unknown as Record<string, unknown>,
          twinMemory,
        }),
      });
      const { ok, data, raw } = await readJsonResponse<{
        error?: string;
        message?: { content?: string };
      }>(res);
      if (!data) {
        loadError = raw.slice(0, 200) || `Could not send (${res.status})`;
        await loadMessages();
        return;
      }
      if (!ok) {
        loadError = errorMessageFromJson(
          data as Record<string, unknown>,
          res.status === 502
            ? 'Assistant unavailable — check API keys or try again.'
            : 'Send failed',
        );
        await loadMessages();
        return;
      }
      await loadMessages();
    } catch {
      loadError = 'Send failed';
      await loadMessages();
    } finally {
      busy = false;
    }
  }

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  const STARTERS: Record<AgentType, { label: string; q: string }[]> = {
    gmail: [
      { label: 'Inbox in 20s', q: 'Summarise my inbox — what matters?' },
      { label: 'Needs reply', q: 'What emails need a reply from me?' },
    ],
    calendar: [
      { label: 'Today', q: "What's on my calendar today?" },
      { label: 'Free time', q: 'When am I free in the next 48 hours?' },
    ],
    instagram: [
      { label: 'How am I doing?', q: 'How is my account performing lately?' },
      { label: 'What to post', q: 'What should I post next based on my stats?' },
    ],
    twin: [
      { label: 'Life pulse', q: "What's going on in my life right now?" },
      { label: 'Evening plan', q: 'Help me plan my evening.' },
    ],
    culture: [
      { label: 'Tonight', q: "I'm free tonight — what kind of plan should I look for?" },
      { label: 'Weekend', q: 'Ideas for this weekend based on my vibe.' },
    ],
  };

  /** Gmail loads a default inbox summary automatically; skip duplicate starter chips. */
  $: starters =
    messages.length === 0 && agentType !== 'gmail'
      ? STARTERS[agentType] ?? STARTERS.twin
      : [];

  $: starterChipItems = starters.map(s => ({ label: s.label, value: s.q }));
</script>

<div class="thread-root">
  {#if loadError}
    <div class="thread-error" role="alert">{loadError}</div>
  {/if}

  <div bind:this={chatEl} class="thread-messages">
    <div class="thread-messages-pad"></div>

    {#each messages as msg (msg.id)}
      {#if msg.sender_type === 'user'}
        <ChatUserBubble text={msg.content} timeLabel={formatTime(msg.created_at)} />
      {:else}
        <div class="bubble-agent fade-up">
          {#if msg.message_type !== 'text' && msg.message_type !== 'card'}
            <div class="insight-card ui-panel ui-panel--solid ui-panel--r14">
              {#if typeof msg.metadata.hook === 'string' && msg.metadata.hook}
                <div class="insight-hook">{msg.metadata.hook}</div>
              {/if}
              {#if typeof msg.metadata.insight === 'string' && msg.metadata.insight}
                <div class="insight-body">{msg.metadata.insight}</div>
              {/if}
              <div class="insight-main">{msg.content}</div>
              {#if Array.isArray(msg.metadata.actions) && msg.metadata.actions.length}
                <div class="action-row">
                  {#each msg.metadata.actions as action}
                    {#if typeof action === 'string'}
                      <button
                        type="button"
                        class="btn-pill-warn btn-pill-warn--md"
                        disabled={busy}
                        on:click={() => void send(action)}>{action}</button
                      >
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <div class="bubble-agent-text">{msg.content}</div>
          {/if}
          <div class="bubble-meta">{formatTime(msg.created_at)}</div>
        </div>
      {/if}
    {/each}

    {#if busy}
      <div class="bubble-agent thinking">Thinking…</div>
    {/if}

    <div class="thread-messages-pad"></div>
  </div>

  <div class="thread-composer">
    <ChatSuggestionChips
      items={starterChipItems}
      disabled={busy}
      layout="thread"
      on:pick={e => void send(e.detail.value)}
    />
    <ChatComposerPill
      variant="thread"
      bind:value={inputText}
      placeholder="Message {agentLabel}…"
      disabled={false}
      {busy}
      on:submit={() => void send()}
    />
  </div>
</div>

<style>
  .thread-root {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
    width: 100%;
    background: transparent;
  }

  .thread-error {
    margin: 8px 16px;
    padding: 10px 12px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--state-error) 12%, transparent);
    color: var(--text-primary);
    font-size: 13px;
  }

  .thread-messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 4px 0 12px;
  }

  @media (min-width: 1024px) {
    .thread-messages {
      scrollbar-width: thin;
    }

    .thread-messages::-webkit-scrollbar {
      display: block;
      width: 8px;
    }

    .thread-messages::-webkit-scrollbar-thumb {
      border-radius: 8px;
      background: color-mix(in srgb, var(--text-muted) 40%, transparent);
    }
  }

  .thread-messages-pad {
    height: 8px;
  }

  .bubble-agent {
    margin: 6px 32px 6px 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .bubble-agent-text {
    max-width: 96%;
    padding: 10px 4px 4px 0;
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .thinking {
    font-size: 13px;
    color: var(--text-muted);
    padding: 8px 16px;
  }

  .insight-card {
    max-width: 100%;
    padding: 12px 14px;
    margin-bottom: 4px;
  }

  .insight-hook {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent-primary);
    margin-bottom: 6px;
  }

  .insight-body {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    white-space: pre-wrap;
  }

  .insight-main {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.45;
    margin-bottom: 10px;
    white-space: pre-wrap;
  }

  .action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .bubble-meta {
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 4px;
    padding: 0 2px;
  }

  .thread-composer {
    flex-shrink: 0;
    padding: 10px 12px max(12px, env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--panel-divider);
    background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
  }

  .fade-up {
    animation: fadeUp 0.28s ease both;
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
