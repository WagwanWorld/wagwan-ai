<script lang="ts">
  export let interactive = false;
  export let raised = false;
  export let className = '';
</script>

<article
  class={`os-card ${raised ? 'os-card--raised' : ''} ${interactive ? 'os-card--interactive' : ''} ${className}`.trim()}
>
  <slot />
</article>
