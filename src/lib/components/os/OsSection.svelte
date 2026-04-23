<script lang="ts">
  export let className = '';
</script>

<section class={`os-section ${className}`.trim()}>
  <slot />
</section>
