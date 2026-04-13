<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import InsightCard from './InsightCard.svelte';

  type InsightData = {
    id: string;
    icon: any;
    category: string;
    statement: string;
    supporting?: string;
  };

  export let insights: InsightData[] = [];

  const dispatch = createEventDispatcher<{ select: { id: string } }>();

  let scrollContainer: HTMLDivElement;
  let activeIndex = 0;
  let autoTimer: ReturnType<typeof setInterval> | null = null;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let mounted = false;

  function getCardWidth(): number {
    if (!scrollContainer) return 300;
    const firstCard = scrollContainer.querySelector('.insight-carousel__item') as HTMLElement | null;
    return firstCard ? firstCard.offsetWidth + 14 /* gap */ : 300;
  }

  function scrollToIndex(index: number) {
    if (!scrollContainer) return;
    const cardWidth = getCardWidth();
    scrollContainer.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
  }

  function advanceNext() {
    if (insights.length === 0) return;
    const next = (activeIndex + 1) % insights.length;
    scrollToIndex(next);
  }

  function startAutoAdvance(interval = 8000) {
    stopAutoAdvance();
    autoTimer = setInterval(advanceNext, interval);
  }

  function stopAutoAdvance() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }

  function handleScroll() {
    if (!scrollContainer) return;
    const cardWidth = getCardWidth();
    if (cardWidth <= 0) return;
    activeIndex = Math.round(scrollContainer.scrollLeft / cardWidth);
  }

  function handleTouchStart() {
    stopAutoAdvance();
  }

  function handleTouchEnd() {
    resumeTimer = setTimeout(() => startAutoAdvance(), 12000);
  }

  function handleCardClick(id: string) {
    dispatch('select', { id });
  }

  function handleDotClick(index: number) {
    scrollToIndex(index);
  }

  onMount(() => {
    mounted = true;
    if (insights.length > 1) {
      startAutoAdvance();
    }
  });

  onDestroy(() => {
    stopAutoAdvance();
  });
</script>

{#if insights.length}
  <div class="insight-carousel">
    <div
      class="insight-carousel__track"
      bind:this={scrollContainer}
      on:scroll={handleScroll}
      on:touchstart={handleTouchStart}
      on:touchend={handleTouchEnd}
      role="region"
      aria-label="Insights carousel"
      tabindex="-1"
    >
      {#each insights as insight, i (insight.id)}
        <div
          class="insight-carousel__item"
          class:insight-carousel__item--visible={mounted}
          style="--stagger: {i}"
        >
          <InsightCard
            icon={insight.icon}
            category={insight.category}
            statement={insight.statement}
            supporting={insight.supporting ?? ''}
            active={activeIndex === i}
            on:click={() => handleCardClick(insight.id)}
          />
        </div>
      {/each}
    </div>

    {#if insights.length > 1}
      <div class="insight-carousel__dots" role="tablist" aria-label="Carousel indicators">
        {#each insights as _, i}
          <button
            class="insight-carousel__dot"
            class:insight-carousel__dot--active={activeIndex === i}
            role="tab"
            aria-selected={activeIndex === i}
            aria-label="Go to insight {i + 1}"
            on:click={() => handleDotClick(i)}
          />
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .insight-carousel {
    width: 100%;
  }

  .insight-carousel__track {
    display: flex;
    gap: 14px;
    padding: 0 20px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .insight-carousel__track::-webkit-scrollbar {
    display: none;
  }

  .insight-carousel__item {
    flex-shrink: 0;
    width: min(300px, 82vw);
    scroll-snap-align: center;
    opacity: 0;
    transform: scale(0.96);
    transition:
      opacity 400ms var(--ease-entrance, ease-out),
      transform 400ms var(--ease-entrance, ease-out);
    transition-delay: calc(var(--stagger, 0) * 80ms);
  }

  .insight-carousel__item--visible {
    opacity: 1;
    transform: scale(1);
  }

  .insight-carousel__dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
  }

  .insight-carousel__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: none;
    padding: 0;
    background: var(--panel-border);
    cursor: pointer;
    transition:
      background 150ms ease,
      transform 150ms ease;
  }

  .insight-carousel__dot--active {
    background: var(--accent-primary);
    transform: scale(1.3);
  }

  @media (prefers-reduced-motion: reduce) {
    .insight-carousel__item {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .insight-carousel__dot {
      transition: none;
    }
  }
</style>
