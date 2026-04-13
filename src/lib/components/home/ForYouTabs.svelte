<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ForYouCard from './ForYouCard.svelte';

  type TabData = {
    id: string;
    label: string;
    emoji: string;
    cards: Array<{
      title: string;
      description: string;
      price: string;
      url: string;
      category: string;
      match_score: number;
      emoji: string;
      image_url?: string;
    }>;
  };

  export let tabs: TabData[] = [];
  export let loading: boolean = false;

  const dispatch = createEventDispatcher<{
    feedback: { title: string; vote: 'up' | 'down' };
  }>();

  let activeTabId: string = '';
  let transitioning = false;

  $: if (tabs.length && !activeTabId) {
    activeTabId = tabs[0].id;
  }

  $: activeTab = tabs.find((t) => t.id === activeTabId);
  $: visibleCards = activeTab?.cards.slice(0, 4) ?? [];
  $: hasTabs = tabs.some((t) => t.cards.length > 0);

  function switchTab(id: string) {
    if (id === activeTabId) return;
    transitioning = true;
    setTimeout(() => {
      activeTabId = id;
      setTimeout(() => {
        transitioning = false;
      }, 20);
    }, 150);
  }

  function handleCardFeedback(
    e: CustomEvent<{ vote: 'up' | 'down' }>,
    title: string
  ) {
    dispatch('feedback', { title, vote: e.detail.vote });
  }
</script>

{#if loading}
  <!-- Loading skeleton -->
  <div class="foryou-tabs">
    <div class="foryou-tabs__bar">
      {#each Array(3) as _}
        <span class="foryou-tabs__ghost-pill">&nbsp;</span>
      {/each}
    </div>
    <div class="foryou-tabs__grid">
      {#each Array(4) as _}
        <div class="foryou-tabs__skeleton"></div>
      {/each}
    </div>
  </div>
{:else if hasTabs}
  <div class="foryou-tabs">
    <!-- Tab bar -->
    <div class="foryou-tabs__bar" role="tablist">
      {#each tabs as tab (tab.id)}
        <button
          type="button"
          class="foryou-tabs__pill"
          class:foryou-tabs__pill--active={tab.id === activeTabId}
          role="tab"
          aria-selected={tab.id === activeTabId}
          on:click={() => switchTab(tab.id)}
        >
          {tab.emoji} {tab.label}
        </button>
      {/each}
    </div>

    <!-- Card grid -->
    <div
      class="foryou-tabs__grid"
      class:foryou-tabs__grid--out={transitioning}
    >
      {#each visibleCards as card (card.title + card.url)}
        <ForYouCard
          title={card.title}
          imageUrl={card.image_url ?? ''}
          category={card.category}
          emoji={card.emoji}
          matchScore={card.match_score}
          url={card.url}
          price={card.price}
          on:feedback={(e) => handleCardFeedback(e, card.title)}
        />
      {/each}
    </div>
  </div>
{/if}

<style>
  .foryou-tabs {
    width: 100%;
  }

  /* ── Tab bar ── */
  .foryou-tabs__bar {
    display: flex;
    gap: 8px;
    padding: 0 20px;
    overflow-x: auto;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .foryou-tabs__bar::-webkit-scrollbar {
    display: none;
  }

  .foryou-tabs__pill {
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    padding: 8px 18px;
    border-radius: 100px;
    white-space: nowrap;
    cursor: pointer;
    border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.12));
    background: var(--glass-light, rgba(255, 255, 255, 0.04));
    color: var(--text-secondary, #999);
    transition:
      background 200ms var(--ease-premium, cubic-bezier(0.22, 1, 0.36, 1)),
      color 200ms var(--ease-premium, cubic-bezier(0.22, 1, 0.36, 1)),
      border-color 200ms var(--ease-premium, cubic-bezier(0.22, 1, 0.36, 1));
  }

  .foryou-tabs__pill--active {
    background: var(--accent-soft, rgba(167, 139, 250, 0.12));
    border-color: oklch(75% 0.22 130 / 0.3);
    color: var(--accent-primary, #a78bfa);
  }

  /* ── Card grid ── */
  .foryou-tabs__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 16px 20px;
    transition:
      opacity 150ms ease,
      transform 200ms var(--ease-premium, cubic-bezier(0.22, 1, 0.36, 1));
  }

  .foryou-tabs__grid--out {
    opacity: 0;
    transform: translateY(0);
  }

  /* Incoming cards animation */
  .foryou-tabs__grid:not(.foryou-tabs__grid--out) {
    animation: foryou-grid-in 200ms var(--ease-premium, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
  }

  @keyframes foryou-grid-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (min-width: 768px) {
    .foryou-tabs__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  /* ── Loading skeletons ── */
  .foryou-tabs__ghost-pill {
    display: inline-block;
    width: 80px;
    height: 34px;
    border-radius: 100px;
    background: var(--glass-medium, rgba(255, 255, 255, 0.06));
    animation: foryou-shimmer 1.5s ease-in-out infinite;
  }

  .foryou-tabs__skeleton {
    aspect-ratio: 3 / 4;
    border-radius: 16px;
    background: var(--glass-medium, rgba(255, 255, 255, 0.06));
    animation: foryou-shimmer 1.5s ease-in-out infinite;
  }

  @keyframes foryou-shimmer {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.8;
    }
  }
</style>
