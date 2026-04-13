<script lang="ts">
  import { onMount } from 'svelte';

  let el: HTMLElement;
  let visible = false;

  onMount(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      visible = true;
      return;
    }
    const obs = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          visible = true;
          obs.disconnect();
        }
      },
      { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  });
</script>

<section bind:this={el} class="day-reveal" class:visible>
  <slot />
</section>

<style>
  .day-reveal {
    opacity: 0;
    transform: translateY(14px);
    transition: opacity 0.18s ease-out, transform 0.18s ease-out;
  }
  .day-reveal.visible {
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    .day-reveal {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
