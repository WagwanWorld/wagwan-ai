<script lang="ts">
  export let as: 'div' | 'main' | 'section' = 'main';
  export let className = '';
</script>

<svelte:element this={as} class={`os-page-shell ${className}`.trim()}>
  <slot />
</svelte:element>
