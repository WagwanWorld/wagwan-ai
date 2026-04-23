<script lang="ts">
  export let title = 'No data yet';
  export let subtitle = '';
  export let className = '';
</script>

<div class={`os-empty ${className}`.trim()}>
  <p style="margin:0;font-size:14px;font-weight:600;color:var(--text-strong);">{title}</p>
  {#if subtitle}
    <p style="margin:8px 0 0;font-size:12px;color:var(--text-body);">{subtitle}</p>
  {/if}
  <slot />
</div>
