<script lang="ts">
  export let className = '';
</script>

<div class={`os-bento-grid ${className}`.trim()}>
  <slot />
</div>
