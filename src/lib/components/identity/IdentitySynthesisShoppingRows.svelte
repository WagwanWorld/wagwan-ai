<script lang="ts">
  import type { IdentitySynthesisShoppingPreferences } from '$lib/types/identitySynthesis';
  import { brandMarkUrlFromText } from '$lib/identity/brandImage';
  import { extractShoppingCardParts, imageUrlForKeyword } from '$lib/identity/visualIdentity';

  export let shopping: IdentitySynthesisShoppingPreferences;

  function cardImageUrl(rowVisual: string, headline: string, detail: string, index: number): string {
    const line = `${headline} ${detail}`.trim();
    const brand = brandMarkUrlFromText(line);
    if (brand) return brand;
    return imageUrlForKeyword(`${rowVisual}-${headline}-${index}`, 'square');
  }

  const ROWS: Array<{ key: keyof IdentitySynthesisShoppingPreferences; label: string; visual: string }> = [
    { key: 'fashion', label: 'Fashion', visual: 'fashion style editorial' },
    { key: 'tech', label: 'Tech', visual: 'minimal desk workspace technology' },
    { key: 'lifestyle', label: 'Lifestyle', visual: 'cafe interior travel' },
    { key: 'digital_products', label: 'Digital', visual: 'app interface design software' },
  ];
</script>

<section class="iv-block" aria-labelledby="iv-shop-h">
  <h3 id="iv-shop-h" class="iv-block__h">Shopping preferences</h3>
  {#each ROWS as row}
    {@const block = shopping[row.key]}
    {#if block.summary?.trim() || block.items?.length}
      <div class="iv-shop-row">
        <p class="iv-shop-row__label">{row.label}</p>
        {#if block.summary?.trim()}
          <p class="iv-shop-row__sum">{block.summary}</p>
        {/if}
        <div class="iv-shop-scroller">
          {#each block.items as it, i}
            {@const parts = extractShoppingCardParts(it)}
            <article class="iv-shop-card">
              <div class="iv-shop-card__imgwrap">
                <img
                  src={cardImageUrl(row.visual, parts.headline, parts.detail ?? '', i)}
                  alt=""
                  class="iv-shop-card__img"
                  referrerpolicy="no-referrer"
                />
              </div>
              <div class="iv-shop-card__meta">
                <p class="iv-shop-card__head">{parts.headline}</p>
                {#if parts.detail}
                  <p class="iv-shop-card__sub">{parts.detail}</p>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
</section>

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

  .iv-shop-row {
    margin-bottom: 1.25rem;
  }

  .iv-shop-row__label {
    margin: 0 0 0.35rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--iv-text, #14120f);
  }

  .iv-shop-row__sum {
    margin: 0 0 0.65rem;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--iv-secondary, #4a4640);
    max-width: 52ch;
  }

  .iv-shop-scroller {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 6px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }

  .iv-shop-card {
    flex: 0 0 140px;
    scroll-snap-align: start;
    border-radius: 14px;
    overflow: hidden;
    background: var(--iv-surface-2, #fff);
    border: 1px solid var(--iv-border, rgba(0, 0, 0, 0.07));
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
  }

  .iv-shop-card__imgwrap {
    aspect-ratio: 1;
    background: #e8e4de;
  }

  .iv-shop-card__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .iv-shop-card__meta {
    padding: 8px 10px 10px;
  }

  .iv-shop-card__head {
    margin: 0 0 0.2rem;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--iv-text, #14120f);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .iv-shop-card__sub {
    margin: 0;
    font-size: 0.65rem;
    line-height: 1.35;
    color: var(--iv-muted, #6b6560);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
