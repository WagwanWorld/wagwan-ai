<script lang="ts">
  /** Inset panel using semantic tokens; pairs with app.css (.ui-panel*). */
  export let solid = false;
  export let r12 = false;
  export let r14 = false;
  export let r16 = false;
  export let clip = false;
  /** When true, renders the double-bezel architecture (outer shell + inner core) */
  export let bezel = false;
  let className = '';
  export { className as class };
</script>

{#if bezel}
  <div class="w-card-bezel {className}">
    <div class="w-card-bezel__inner">
      <slot />
    </div>
  </div>
{:else}
  <div
    class="ui-panel {className}"
    class:ui-panel--solid={solid}
    class:ui-panel--r12={r12}
    class:ui-panel--r14={r14}
    class:ui-panel--r16={r16}
    class:ui-panel--clip={clip}
  >
    <slot />
  </div>
{/if}
