<script lang="ts">
  export let title: string;
  export let kicker: string | undefined = undefined;
</script>

<div class="section-header">
  {#if kicker}
    <p class="section-header__kicker">{kicker}</p>
  {/if}
  <h2 class="section-header__title">{title}</h2>
  {#if $$slots.action}
    <div class="section-header__action">
      <slot name="action" />
    </div>
  {/if}
</div>

<style>
  .section-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px 12px;
    margin-bottom: 12px;
  }

  .section-header__kicker {
    width: 100%;
    margin: 0 0 2px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .section-header__title {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .section-header__action {
    margin-left: auto;
  }
</style>
