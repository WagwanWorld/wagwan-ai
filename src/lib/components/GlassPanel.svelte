<script lang="ts">
  /** Inset panel using semantic tokens; pairs with app.css (.ui-panel*). */
  export let solid = false;
  export let r12 = false;
  export let r14 = false;
  export let r16 = false;
  export let clip = false;
  let className = '';
  export { className as class };
</script>

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
