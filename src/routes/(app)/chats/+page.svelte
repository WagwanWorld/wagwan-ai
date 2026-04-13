<script lang="ts">
  import { goto } from '$app/navigation';
  import { profile } from '$lib/stores/profile';
  import {
    AGENT_LABELS,
    AGENT_TAGLINES,
    FEATURED_AGENT_TYPES,
    type AgentType,
  } from '$lib/chats/agentConstants';
  import Envelope from 'phosphor-svelte/lib/Envelope';
  import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank';
  import Camera from 'phosphor-svelte/lib/Camera';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import MaskHappy from 'phosphor-svelte/lib/MaskHappy';
  import CaretRight from 'phosphor-svelte/lib/CaretRight';
  import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';

  interface ChatItem {
    id: string;
    agent_type: AgentType;
    title: string;
    last_message_at: string | null;
    unread_count: number;
    last_preview: string;
  }

  let chats: ChatItem[] = [];
  let loading = true;
  let err = '';
  let apiWarning = '';
  let apiHint = '';
  let lastSub = '';
  let postBusy = false;
  let postHint = '';

  function iconFor(agent: AgentType) {
    switch (agent) {
      case 'gmail':
        return Envelope;
      case 'calendar':
        return CalendarBlank;
      case 'instagram':
        return Camera;
      case 'twin':
        return Sparkle;
      case 'culture':
        return MaskHappy;
      default:
        return Sparkle;
    }
  }

  function formatWhen(iso: string | null) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      if (sameDay) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  async function loadChats() {
    const sub = ($profile.googleSub ?? '').trim();
    if (!sub) {
      loading = false;
      err = 'Sign in required';
      chats = [];
      apiWarning = '';
      apiHint = '';
      return;
    }

    loading = true;
    err = '';
    apiWarning = '';
    apiHint = '';

    try {
      const r = await fetch(`/api/chats?sub=${encodeURIComponent(sub)}`);
      const d = await r.json();
      if (!r.ok) {
        err = typeof d.error === 'string' ? d.error : 'Could not load chats';
        chats = [];
        return;
      }
      chats = (d.chats ?? []) as ChatItem[];
      if (typeof d.warning === 'string') apiWarning = d.warning;
      if (typeof d.hint === 'string') apiHint = d.hint;
    } catch {
      err = 'Network error';
      chats = [];
    } finally {
      loading = false;
    }
  }

  async function setupChats() {
    await loadChats();
  }

  type PostChatsJson = {
    ok?: boolean;
    error?: string;
    hint?: string;
    chat?: { id: string; agent_type: string };
    chats?: Array<{ id: string; agent_type: string }>;
  };

  async function postChats(
    body: Record<string, string>,
  ): Promise<{ r: Response | null; d: PostChatsJson }> {
    const sub = ($profile.googleSub ?? '').trim();
    if (!sub) {
      return { r: null, d: { ok: false, error: 'Sign in required' } };
    }
    const r = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub, ...body }),
    });
    const d = (await r.json()) as PostChatsJson;
    return { r, d };
  }

  /** Creates all agent threads in Supabase, then opens Twin (or first thread). */
  async function createNewChat() {
    const sub = ($profile.googleSub ?? '').trim();
    if (!sub) {
      err = 'Sign in required';
      return;
    }
    postBusy = true;
    postHint = '';
    try {
      const { r, d } = await postChats({});
      if (!r) {
        err = typeof d.error === 'string' ? d.error : 'Sign in required';
        return;
      }
      if (typeof d.hint === 'string') postHint = d.hint;
      if (r.ok && d.chats?.length) {
        await loadChats();
        const twin = d.chats.find(c => c.agent_type === 'twin') ?? d.chats[0];
        if (twin?.id) goto(`/chat/${twin.id}`);
      } else if (!r.ok) {
        apiWarning = typeof d.error === 'string' ? d.error : 'chats_unavailable';
        apiHint = typeof d.hint === 'string' ? d.hint : postHint;
        await loadChats();
      }
    } finally {
      postBusy = false;
    }
  }

  /** Open featured agent: use existing row or POST ensure for that agent. */
  async function openFeaturedAgent(agent: AgentType) {
    const sub = ($profile.googleSub ?? '').trim();
    if (!sub) {
      err = 'Sign in required';
      return;
    }
    const existing = chats.find(c => c.agent_type === agent);
    if (existing) {
      goto(`/chat/${existing.id}`);
      return;
    }
    postBusy = true;
    postHint = '';
    try {
      const { r, d } = await postChats({ agent });
      if (!r) {
        err = typeof d.error === 'string' ? d.error : 'Sign in required';
        return;
      }
      if (typeof d.hint === 'string') postHint = d.hint;
      if (r.ok && d.chat?.id) {
        await loadChats();
        goto(`/chat/${d.chat.id}`);
      } else {
        apiWarning = typeof d.error === 'string' ? d.error : 'chat_create_failed';
        apiHint = typeof d.hint === 'string' ? d.hint : postHint;
        await loadChats();
      }
    } finally {
      postBusy = false;
    }
  }

  $: {
    const sub = ($profile.googleSub ?? '').trim();
    if (!sub) {
      lastSub = '';
      loading = false;
      err = 'Sign in required';
      chats = [];
      apiWarning = '';
      apiHint = '';
    } else if (sub !== lastSub) {
      lastSub = sub;
      void loadChats();
    }
  }
</script>

<svelte:head>
  <title>Chats — Wagwan</title>
</svelte:head>

<div class="chats-page">
  <header class="chats-header">
    <div class="chats-header-row">
      <div>
        <h1 class="chats-title">Chats</h1>
        <p class="chats-sub">One thread per agent — Gmail, Calendar, Instagram, Twin, Culture.</p>
      </div>
      <div class="chats-header-actions">
        {#if ($profile.googleSub ?? '').trim() && !err}
          <button
            type="button"
            class="chats-new-chat btn-pill-warn"
            disabled={loading || postBusy}
            on:click={() => void createNewChat()}
          >
            {postBusy ? '…' : 'Create new chat'}
          </button>
        {/if}
        {#if chats.length > 0}
          <button
            type="button"
            class="chats-sync ui-icon-btn-ghost"
            class:chats-sync--busy={loading}
            title="Refresh threads"
            aria-label="Refresh chats"
            disabled={loading}
            on:click={() => void setupChats()}
          >
            <ArrowClockwise size={20} weight="light" />
          </button>
        {/if}
      </div>
    </div>
  </header>

  {#if ($profile.googleSub ?? '').trim() && !err}
    <section class="chats-featured" aria-labelledby="chats-featured-title">
      <h2 id="chats-featured-title" class="chats-featured-title">Start with an agent</h2>
      <p class="chats-featured-sub">
        Tap an agent to open its thread. If Supabase is set up, we create the row automatically.
      </p>
      <div class="chats-featured-grid">
        {#each FEATURED_AGENT_TYPES as agent (agent)}
          {@const Icon = iconFor(agent)}
          <button
            type="button"
            class="chats-agent-tile"
            disabled={loading || postBusy}
            on:click={() => void openFeaturedAgent(agent)}
          >
            <div
              class="chats-agent-tile-icon"
              class:gmail={agent === 'gmail'}
              class:ig={agent === 'instagram'}
              class:twin={agent === 'twin'}
            >
              <Icon size={24} weight="light" />
            </div>
            <div class="chats-agent-tile-body">
              <span class="chats-agent-tile-name">{AGENT_LABELS[agent]}</span>
              <span class="chats-agent-tile-tag">{AGENT_TAGLINES[agent]}</span>
            </div>
            <span class="chats-agent-tile-go" aria-hidden="true">
              <CaretRight size={18} weight="light" />
            </span>
          </button>
        {/each}
      </div>
      {#if postHint && !loading}
        <p class="chats-inline-hint" role="status">{postHint}</p>
      {/if}
    </section>
  {/if}

  {#if loading}
    <div class="chats-loading ui-panel ui-panel--solid ui-panel--r14">Loading…</div>
  {:else if err}
    <div class="chats-err ui-panel ui-panel--solid ui-panel--r14" role="alert">{err}</div>
  {:else if chats.length === 0}
    <div class="chats-empty ui-panel ui-panel--solid ui-panel--r14">
      <h2 class="chats-empty-title">No threads in Supabase yet</h2>
      <p class="chats-empty-lead">
        Use <strong>Create new chat</strong> or an agent tile above once your database is ready. First-time setup:
      </p>
      <ul class="chats-empty-list">
        <li>Run <code class="chats-code">supabase/003_multi_agent_chats.sql</code> in the Supabase SQL editor.</li>
        <li>Confirm <code class="chats-code">SUPABASE_URL</code> and <code class="chats-code">SUPABASE_SERVICE_ROLE_KEY</code> in <code class="chats-code">.env</code>.</li>
        <li>Run <code class="chats-code">supabase/migration.sql</code> and <code class="chats-code">002_identity_graph.sql</code> first if you have not.</li>
      </ul>
      {#if apiHint}
        <p class="chats-empty-hint" role="status">{apiHint}</p>
      {:else if apiWarning}
        <p class="chats-empty-hint" role="status">Still empty — check server logs for insert errors.</p>
      {/if}
      <div class="chats-empty-actions">
        <button
          type="button"
          class="btn-pill-warn btn-pill-warn--lg chats-setup-btn"
          disabled={loading || postBusy || !($profile.googleSub ?? '').trim()}
          on:click={() => void createNewChat()}
        >
          {postBusy ? 'Working…' : 'Create new chat'}
        </button>
        <button
          type="button"
          class="chats-setup-secondary"
          disabled={loading || postBusy || !($profile.googleSub ?? '').trim()}
          on:click={() => void setupChats()}
        >
          Refresh list
        </button>
      </div>
    </div>
  {:else}
    <h2 class="chats-all-title">All threads</h2>
    <ul class="chat-list" aria-label="Agent threads">
      {#each chats as c (c.id)}
        {@const Icon = iconFor(c.agent_type)}
        <li>
          <button
            type="button"
            class="chat-row ui-interactive-panel"
            on:click={() => goto(`/chat/${c.id}`)}
          >
            <div
              class="chat-row-icon"
              class:gmail={c.agent_type === 'gmail'}
              class:cal={c.agent_type === 'calendar'}
              class:ig={c.agent_type === 'instagram'}
              class:twin={c.agent_type === 'twin'}
              class:culture={c.agent_type === 'culture'}
            >
              <Icon size={22} weight="light" />
            </div>
            <div class="chat-row-body">
              <div class="chat-row-top">
                <span class="chat-row-name">{AGENT_LABELS[c.agent_type]}</span>
                <span class="chat-row-time">{formatWhen(c.last_message_at)}</span>
              </div>
              <div class="chat-row-preview">
                {c.last_preview || `Open ${AGENT_LABELS[c.agent_type]}`}
              </div>
            </div>
            {#if c.unread_count > 0}
              <span class="chat-unread">{c.unread_count > 9 ? '9+' : c.unread_count}</span>
            {/if}
            <span class="chat-chevron" aria-hidden="true">
              <CaretRight size={18} weight="light" />
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .chats-page {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: max(40px, env(safe-area-inset-top)) clamp(14px, 2.2vw, 28px)
      max(96px, calc(env(safe-area-inset-bottom) + 72px)) clamp(14px, 2.2vw, 28px);
  }

  @media (min-width: 1024px) {
    .chats-page {
      padding-top: max(22px, env(safe-area-inset-top));
      padding-bottom: max(28px, env(safe-area-inset-bottom));
    }
  }

  .chats-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .chats-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .chats-new-chat {
    margin: 0;
    padding: 9px 16px;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .chats-sync {
    flex-shrink: 0;
    margin-top: 4px;
  }

  .chats-sync--busy :global(svg) {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .chats-header {
    margin-bottom: 16px;
    padding: 12px 14px;
    border: 1px solid var(--panel-border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--glass-light) 88%, transparent);
    box-shadow: var(--shadow-tall-card);
  }

  .chats-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0 0 6px;
    letter-spacing: -0.02em;
  }

  .chats-sub {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  .chats-featured {
    margin-bottom: 16px;
    padding: 14px;
    border: 1px solid var(--panel-border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--glass-light) 88%, transparent);
    box-shadow: var(--shadow-tall-card);
  }

  .chats-featured-title {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .chats-featured-sub {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-secondary);
  }

  .chats-featured-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .chats-agent-tile {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 14px 14px 16px;
    margin: 0;
    border-radius: 16px;
    border: 1px solid var(--panel-border);
    background: var(--panel-surface);
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .chats-agent-tile:hover:not(:disabled) {
    background: var(--panel-hover);
    border-color: var(--border-strong);
  }

  .chats-agent-tile:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .chats-agent-tile-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--glass-medium);
    color: var(--text-primary);
  }

  .chats-agent-tile-icon.gmail {
    color: #ea4335;
  }
  .chats-agent-tile-icon.ig {
    color: #e1306c;
  }
  .chats-agent-tile-icon.twin {
    color: var(--accent-primary);
  }

  .chats-agent-tile-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chats-agent-tile-name {
    font-weight: 700;
    font-size: 15px;
    color: var(--text-primary);
  }

  .chats-agent-tile-tag {
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .chats-agent-tile-go {
    color: var(--text-muted);
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .chats-inline-hint {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .chats-all-title {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .chats-loading,
  .chats-err {
    padding: 16px;
    font-size: 14px;
  }

  .chats-empty {
    padding: 20px 18px;
  }

  .chats-empty-title {
    margin: 0 0 8px;
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .chats-empty-lead {
    margin: 0 0 14px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  .chats-empty-list {
    margin: 0 0 16px;
    padding-left: 1.15rem;
    font-size: 13px;
    line-height: 1.55;
    color: var(--text-secondary);
  }

  .chats-empty-list li {
    margin-bottom: 6px;
  }

  .chats-code {
    font-size: 12px;
    background: var(--glass-medium);
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
  }

  .chats-empty-hint {
    margin: 0 0 16px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .chats-empty-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .chats-setup-btn {
    width: 100%;
    max-width: 320px;
  }

  .chats-setup-secondary {
    margin: 0;
    padding: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--accent-primary);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .chats-setup-secondary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .chat-list {
    list-style: none;
    margin: 0;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid var(--panel-border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--glass-light) 88%, transparent);
    box-shadow: var(--shadow-tall-card);
  }

  .chat-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px 12px 14px;
    border-radius: 16px;
    border: 1px solid var(--panel-border);
    background: var(--panel-surface);
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .chat-row:hover {
    background: var(--panel-hover);
    border-color: var(--border-strong);
  }

  .chat-row-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--glass-medium);
    color: var(--text-primary);
  }

  .chat-row-icon.gmail {
    color: #ea4335;
  }
  .chat-row-icon.cal {
    color: #4285f4;
  }
  .chat-row-icon.ig {
    color: #e1306c;
  }
  .chat-row-icon.twin {
    color: var(--accent-primary);
  }
  .chat-row-icon.culture {
    color: var(--brand-gold-mid);
  }

  .chat-row-body {
    flex: 1;
    min-width: 0;
  }

  .chat-row-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .chat-row-name {
    font-weight: 700;
    font-size: 15px;
    color: var(--text-primary);
  }

  .chat-row-time {
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .chat-row-preview {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chat-unread {
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--accent-primary);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .chat-chevron {
    color: var(--text-muted);
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
</style>
