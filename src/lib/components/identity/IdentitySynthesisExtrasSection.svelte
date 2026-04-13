<script lang="ts">
  import type { IdentitySynthesisOptionalExtras } from '$lib/types/identitySynthesis';

  export let optional: IdentitySynthesisOptionalExtras;
</script>

{#if optional.people_you_get_along_with?.length || optional.brands_that_match?.length || optional.experiences_youd_love?.length || optional.content_you_should_create?.length}
  <section class="iv-block" aria-label="Also">
    <h3 class="iv-block__h">Also</h3>
    {#if optional.people_you_get_along_with?.length}
      <p class="iv-extra-label">People you’d likely get along with</p>
      <div class="iv-extra-chips">
        {#each optional.people_you_get_along_with as x}
          <span class="iv-chip">{x}</span>
        {/each}
      </div>
    {/if}
    {#if optional.brands_that_match?.length}
      <p class="iv-extra-label">Brands that match your energy</p>
      <div class="iv-extra-chips">
        {#each optional.brands_that_match as x}
          <span class="iv-chip">{x}</span>
        {/each}
      </div>
    {/if}
    {#if optional.experiences_youd_love?.length}
      <p class="iv-extra-label">Experiences you’d love</p>
      <div class="iv-extra-chips">
        {#each optional.experiences_youd_love as x}
          <span class="iv-chip">{x}</span>
        {/each}
      </div>
    {/if}
    {#if optional.content_you_should_create?.length}
      <p class="iv-extra-label">Content you should be creating</p>
      <div class="iv-extra-chips">
        {#each optional.content_you_should_create as x}
          <span class="iv-chip">{x}</span>
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .iv-block {
    margin: 0;
  }

  .iv-block__h {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
    margin: 0 0 0.85rem;
  }

  .iv-extra-label {
    margin: 0.75rem 0 0.4rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
  }

  .iv-extra-label:first-of-type {
    margin-top: 0;
  }

  .iv-extra-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .iv-chip {
    font-size: 0.76rem;
    padding: 0.35rem 0.65rem;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.08));
    color: var(--iv-text, #14120f);
  }
</style>
