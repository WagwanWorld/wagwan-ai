<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { profile } from '$lib/stores/profile';
  import { AGENT_LABELS, type AgentType } from '$lib/chats/agentConstants';
  import AgentChatThread from '$lib/components/chats/AgentChatThread.svelte';
  import { ArrowLeft } from '@lucide/svelte';

  let agentType: AgentType | null = null;
  let chatId = '';
  let agentLabel = 'Agent';
  let loadMetaErr = '';
  let metaLoading = true;

  $: chatId = $page.params.id ?? '';

  let lastFetchedId = '';

  async function fetchMeta(id: string, sub: string) {
    if (!sub || !id) {
      metaLoading = false;
      return;
    }
    metaLoading = true;
    loadMetaErr = '';
    agentType = null;
    agentLabel = 'Agent';
    try {
      const r = await fetch(`/api/chats/${encodeURIComponent(id)}?sub=${encodeURIComponent(sub)}`);
      if (!r.ok) {
        loadMetaErr = 'Chat not found';
        return;
      }
      const d = await r.json();
      const at = d.chat?.agent_type as AgentType | undefined;
      if (at && AGENT_LABELS[at]) {
        agentType = at;
        agentLabel = AGENT_LABELS[at];
      }
    } catch {
      loadMetaErr = 'Could not load chat';
    } finally {
      metaLoading = false;
    }
  }

  $: {
    const sub = $profile.googleSub ?? '';
    if (chatId && sub && chatId !== lastFetchedId) {
      lastFetchedId = chatId;
      void fetchMeta(chatId, sub);
    }
  }
</script>

<svelte:head>
  <title>{agentLabel} — Wagwan</title>
</svelte:head>

<div class="chat-shell">
  <header class="chat-top">
    <button
      type="button"
      class="chat-back ui-icon-btn-ghost"
      aria-label="Back to chats"
      on:click={() => goto('/chats')}
    >
      <ArrowLeft size={22} strokeWidth={1.9} />
    </button>
    <div class="chat-top-titles">
      <span class="chat-top-name">{agentLabel}</span>
      {#if loadMetaErr}
        <span class="chat-top-err">{loadMetaErr}</span>
      {/if}
    </div>
  </header>

  {#if chatId && !loadMetaErr && agentType}
    {#key chatId}
      <div class="chat-thread-body">
        <AgentChatThread {chatId} {agentLabel} {agentType} />
      </div>
    {/key}
  {:else if chatId && !loadMetaErr && metaLoading}
    <div class="chat-loading ui-panel ui-panel--solid ui-panel--r14">Loading chat…</div>
  {/if}
</div>

<style>
  .chat-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
    max-width: none;
    margin: 0;
    width: 100%;
    padding: max(14px, env(safe-area-inset-top)) clamp(14px, 2.2vw, 28px)
      max(88px, env(safe-area-inset-bottom)) clamp(14px, 2.2vw, 28px);
    background: transparent;
  }

  .chat-thread-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 1px solid var(--panel-border);
    border-top: none;
    border-radius: 0 0 18px 18px;
    overflow: hidden;
    background: color-mix(in srgb, var(--glass-light) 88%, transparent);
    box-shadow: var(--shadow-tall-card);
  }

  .chat-top {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 12px 10px;
    border: 1px solid var(--panel-border);
    border-bottom: 1px solid var(--panel-divider);
    border-radius: 18px 18px 0 0;
    background: color-mix(in srgb, var(--glass-light) 88%, transparent);
  }

  .chat-back {
    flex-shrink: 0;
  }

  .chat-top-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .chat-top-name {
    font-weight: 800;
    font-size: 17px;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .chat-top-err {
    font-size: 12px;
    color: var(--state-error);
  }

  .chat-loading {
    margin: 14px 0 0;
    padding: 16px;
    font-size: 14px;
    color: var(--text-secondary);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--glass-light) 88%, transparent);
  }
</style>
