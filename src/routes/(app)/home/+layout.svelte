<script lang="ts">
  /** Home owns scroll in the expanded feed; latch is flex-fill without outer scroll. */
</script>

<div class="home-route-root">
  <slot />
</div>

<style>
  .home-route-root {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    height: 100%;
  }
</style>
