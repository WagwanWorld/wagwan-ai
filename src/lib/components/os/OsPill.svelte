<script lang="ts">
  export let accent = false;
  export let className = '';
</script>

<span class={`os-pill ${accent ? 'os-pill--accent' : ''} ${className}`.trim()}>
  <slot />
</span>
