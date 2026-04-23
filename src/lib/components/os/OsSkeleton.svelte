<script lang="ts">
  export let height = '16px';
  export let width = '100%';
  export let className = '';
</script>

<div class={`os-skeleton ${className}`.trim()} style={`height:${height};width:${width};`}></div>
