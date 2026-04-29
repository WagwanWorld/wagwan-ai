<script lang="ts">
  import type { BrandScheme } from '$lib/types/brand-os';

  export let brandScheme: BrandScheme | null = null;
  export let brandName: string = '';
  export let syncing: boolean = false;
  export let onRescan: (url?: string) => void = () => {};

  let urlInput: string = '';
  let scanning: boolean = false;

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 2) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function handleScan() {
    scanning = true;
    onRescan(urlInput.trim() || undefined);
  }

  function handleRescan() {
    scanning = true;
    onRescan();
  }

  $: if (brandScheme) scanning = false;
  $: brandInitial = (brandName || '?')[0].toUpperCase();
</script>

<!-- ── EMPTY STATE ── -->
{#if !brandScheme && !scanning}
  <div class="bss-empty">
    <div class="bss-label">BRAND SCHEME</div>
    <p class="bss-empty-desc">
      Scan your website to build your brand identity — colors, fonts, logo, and application mockups.
    </p>
    <div class="bss-url-row">
      <input
        class="bss-url-input"
        type="url"
        placeholder="https://yourbrand.com"
        bind:value={urlInput}
        on:keydown={(e) => e.key === 'Enter' && urlInput.trim() && handleScan()}
      />
      <button class="bss-scan-btn" disabled={!urlInput.trim()} on:click={handleScan}>
        Scan Website
      </button>
    </div>
  </div>

<!-- ── SCANNING STATE ── -->
{:else if scanning && !brandScheme}
  <div class="bss-grid">
    <!-- skeleton header -->
    <div class="bss-skeleton-header">
      <div class="bss-skel bss-skel-logo"></div>
      <div class="bss-skel-lines">
        <div class="bss-skel bss-skel-line" style="width:120px"></div>
        <div class="bss-skel bss-skel-line" style="width:80px; margin-top:6px"></div>
      </div>
    </div>
    <!-- skeleton cards -->
    {#each [1, 2, 3] as _}
      <div class="bs-card bss-skel-card">
        <div class="bss-skel bss-skel-line" style="width:80px; margin-bottom:14px"></div>
        <div class="bss-skel bss-skel-block"></div>
        <div class="bss-skel bss-skel-line" style="width:100%; margin-top:10px"></div>
        <div class="bss-skel bss-skel-line" style="width:70%; margin-top:6px"></div>
      </div>
    {/each}
  </div>

<!-- ── LOADED STATE ── -->
{:else if brandScheme}
  <div class="bss-grid">

    <!-- Row A: Header (span 3) -->
    <div class="bss-header">
      <div class="bss-header-left">
        {#if brandScheme.logo?.darkUrl || brandScheme.logo?.faviconUrl}
          <img
            class="bss-logo-img"
            src={brandScheme.logo.darkUrl ?? brandScheme.logo.faviconUrl ?? ''}
            alt={brandName}
          />
        {:else}
          <div class="bss-logo-fallback">{brandInitial}</div>
        {/if}
        <div class="bss-header-text">
          <div class="bss-brand-name">{brandName}</div>
          {#if brandScheme.sourceUrl}
            <div class="bss-source-url">{brandScheme.sourceUrl}</div>
          {/if}
          {#if brandScheme.tagline}
            <div class="bss-tagline">{brandScheme.tagline}</div>
          {/if}
        </div>
      </div>
      <div class="bss-header-right">
        <span class="bss-scraped-badge">SCRAPED {timeAgo(brandScheme.scrapedAt).toUpperCase()}</span>
        <button class="bss-rescan-btn" on:click={handleRescan} disabled={syncing}>
          RESCAN
        </button>
      </div>
    </div>

    <!-- Row B Card 1: Color Palette -->
    <div class="bs-card">
      <div class="bss-card-label">COLOR PALETTE</div>
      <div class="bss-palette-grid">
        {#each brandScheme.palette as color}
          <div class="bss-swatch-wrap">
            <div
              class="bss-swatch"
              style="background:{color.hex}; border-color:{color.role === 'primary' ? 'rgba(232,131,58,0.4)' : 'rgba(255,255,255,0.08)'};"
            ></div>
            <div class="bss-swatch-name">{color.name}</div>
            <div class="bss-swatch-hex">{color.hex}</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Row B Card 2: Typography -->
    <div class="bs-card">
      <div class="bss-card-label">TYPOGRAPHY</div>

      <!-- Heading specimen -->
      <div class="bss-type-specimen">
        <div class="bss-type-tag bss-type-tag--accent">{brandScheme.typography.heading.family}</div>
        <div
          class="bss-type-sample bss-type-sample--heading"
          style="font-family:'{brandScheme.typography.heading.family}', sans-serif"
        >
          The quick brown fox
        </div>
        <div class="bss-type-chips">
          {#each brandScheme.typography.heading.weights as w}
            <span class="bss-chip">{w}</span>
          {/each}
          <span class="bss-chip bss-chip--source">{brandScheme.typography.heading.source}</span>
        </div>
      </div>

      <!-- Body specimen -->
      <div class="bss-type-specimen" style="margin-top:14px">
        <div class="bss-type-tag">{brandScheme.typography.body.family}</div>
        <div
          class="bss-type-sample bss-type-sample--body"
          style="font-family:'{brandScheme.typography.body.family}', sans-serif"
        >
          Aa Bb Cc Dd Ee Ff Gg
        </div>
        <div class="bss-type-chips">
          {#each brandScheme.typography.body.weights as w}
            <span class="bss-chip">{w}</span>
          {/each}
          <span class="bss-chip bss-chip--source">{brandScheme.typography.body.source}</span>
        </div>
      </div>

      <!-- Mono specimen (optional) -->
      {#if brandScheme.typography.mono}
        <div class="bss-type-specimen" style="margin-top:14px">
          <div class="bss-type-tag">{brandScheme.typography.mono.family}</div>
          <div
            class="bss-type-sample bss-type-sample--mono"
            style="font-family:'{brandScheme.typography.mono.family}', monospace"
          >
            0123456789
          </div>
          <div class="bss-type-chips">
            {#each brandScheme.typography.mono.weights as w}
              <span class="bss-chip">{w}</span>
            {/each}
            <span class="bss-chip bss-chip--source">{brandScheme.typography.mono.source}</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Row B Card 3: Logo System -->
    <div class="bs-card">
      <div class="bss-card-label">LOGO SYSTEM</div>
      <div class="bss-logo-variants">
        <!-- Dark variant -->
        <div class="bss-logo-square bss-logo-square--dark">
          {#if brandScheme.logo?.darkUrl}
            <img src={brandScheme.logo.darkUrl} alt="dark logo" class="bss-logo-variant-img" />
          {:else if brandScheme.logo?.lightUrl}
            <img src={brandScheme.logo.lightUrl} alt="dark logo" class="bss-logo-variant-img" style="filter:invert(1)" />
          {:else}
            <div class="bss-logo-initial">{brandInitial}</div>
          {/if}
        </div>
        <!-- Light variant -->
        <div class="bss-logo-square bss-logo-square--light">
          {#if brandScheme.logo?.lightUrl}
            <img src={brandScheme.logo.lightUrl} alt="light logo" class="bss-logo-variant-img" />
          {:else if brandScheme.logo?.darkUrl}
            <img src={brandScheme.logo.darkUrl} alt="light logo" class="bss-logo-variant-img" style="filter:invert(1)" />
          {:else}
            <div class="bss-logo-initial bss-logo-initial--dark">{brandInitial}</div>
          {/if}
        </div>
      </div>
      <div class="bss-logo-caption">DARK / LIGHT VARIANTS</div>
    </div>

    <!-- Row C: Application Examples (span 3) -->
    <div class="bss-apps-row">
      <div class="bss-card-label" style="margin-bottom:12px">APPLICATION EXAMPLES</div>
      <div class="bss-apps-grid">

        <!-- Instagram Post 1:1 -->
        <div class="bss-app-card">
          <div class="bss-app-label">Instagram Post</div>
          <div
            class="bss-app-body bss-app-body--square"
            style="background: linear-gradient(135deg, {brandScheme.palette[0]?.hex ?? '#1a1a2e'}, {brandScheme.palette[1]?.hex ?? '#E8833A'})"
          >
            <span class="bss-app-desc">{brandScheme.applications.igPost}</span>
          </div>
        </div>

        <!-- Business Card 1.6:1 -->
        <div class="bss-app-card">
          <div class="bss-app-label">Business Card</div>
          <div
            class="bss-app-body bss-app-body--bc"
            style="background: linear-gradient(135deg, {brandScheme.palette[0]?.hex ?? '#1a1a2e'}, {brandScheme.palette[2]?.hex ?? '#E87FA8'})"
          >
            <span class="bss-app-desc">{brandScheme.applications.businessCard}</span>
          </div>
        </div>

        <!-- Website Header 3:1 -->
        <div class="bss-app-card">
          <div class="bss-app-label">Website Header</div>
          <div
            class="bss-app-body bss-app-body--web"
            style="background: linear-gradient(135deg, {brandScheme.palette[1]?.hex ?? '#E8833A'}, {brandScheme.palette[3]?.hex ?? '#EDEDEF'})"
          >
            <span class="bss-app-desc">{brandScheme.applications.websiteHeader}</span>
          </div>
        </div>

        <!-- Social Banner 16:9 -->
        <div class="bss-app-card">
          <div class="bss-app-label">Social Banner</div>
          <div
            class="bss-app-body bss-app-body--banner"
            style="background: linear-gradient(135deg, {brandScheme.palette[2]?.hex ?? '#E87FA8'}, {brandScheme.palette[0]?.hex ?? '#1a1a2e'})"
          >
            <span class="bss-app-desc">{brandScheme.applications.socialBanner}</span>
          </div>
        </div>

      </div>
    </div>

  </div>
{/if}

<style>
  /* ── Shimmer animation ── */
  @keyframes bsi-shimmer {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 0.8; }
  }

  /* ── Skeleton helpers ── */
  .bss-skel {
    background: rgba(255,255,255,0.07);
    border-radius: 6px;
    animation: bsi-shimmer 1.6s ease-in-out infinite;
  }
  .bss-skel-logo  { width: 56px; height: 56px; border-radius: 10px; flex-shrink: 0; }
  .bss-skel-line  { height: 12px; }
  .bss-skel-block { height: 80px; width: 100%; border-radius: 10px; }

  /* ── Grid layout (shared by scanning + loaded states) ── */
  .bss-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 14px;
    width: 100%;
  }

  /* Skeleton header and cards span correctly */
  .bss-skeleton-header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 0 4px;
  }
  .bss-skel-lines { display: flex; flex-direction: column; flex: 1; }
  .bss-skel-card  { padding: 18px; min-height: 140px; }

  /* ── EMPTY STATE ── */
  .bss-empty {
    width: 100%;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .bss-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.1em;
    color: #4A4A50;
    text-transform: uppercase;
  }
  .bss-empty-desc {
    font-size: 13px;
    color: #8A8A92;
    line-height: 1.5;
    margin: 0;
    max-width: 480px;
  }
  .bss-url-row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .bss-url-input {
    flex: 1;
    min-width: 200px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 9px 14px;
    color: #EDEDEF;
    font-size: 13px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    outline: none;
    transition: border-color 0.15s;
  }
  .bss-url-input:focus {
    border-color: rgba(232,131,58,0.5);
  }
  .bss-url-input::placeholder { color: #4A4A50; }
  .bss-scan-btn {
    padding: 9px 20px;
    border-radius: 8px;
    background: #E8833A;
    color: #0d0d10;
    font-size: 12px;
    font-weight: 600;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    letter-spacing: 0.05em;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .bss-scan-btn:hover:not(:disabled) { opacity: 0.85; }
  .bss-scan-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  /* ── LOADED: Header row (span 3) ── */
  .bss-header {
    grid-column: 1 / -1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 4px 0 6px;
    flex-wrap: wrap;
  }
  .bss-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .bss-logo-img {
    width: 72px;
    height: 72px;
    border-radius: 12px;
    object-fit: contain;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .bss-logo-fallback {
    width: 72px;
    height: 72px;
    border-radius: 12px;
    background: rgba(232,131,58,0.12);
    border: 1px solid rgba(232,131,58,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    color: #E8833A;
    font-family: 'PP Mori', 'Geist Variable', 'Inter', -apple-system, sans-serif;
    flex-shrink: 0;
  }
  .bss-header-text { display: flex; flex-direction: column; gap: 3px; }
  .bss-brand-name  { font-size: 20px; font-weight: 700; color: #EDEDEF; line-height: 1.2; }
  .bss-source-url  { font-size: 11px; font-family: 'Geist Mono Variable', 'SF Mono', monospace; color: #6A6A72; }
  .bss-tagline     { font-size: 12px; color: #8A8A92; font-style: italic; }

  .bss-header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    padding-top: 4px;
  }
  .bss-scraped-badge {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.1em;
    color: #4A4A50;
    padding: 4px 8px;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 4px;
    white-space: nowrap;
  }
  .bss-rescan-btn {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.1em;
    color: #E8833A;
    border: 1px solid rgba(232,131,58,0.3);
    border-radius: 5px;
    background: transparent;
    padding: 5px 10px;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .bss-rescan-btn:hover:not(:disabled) { background: rgba(232,131,58,0.08); }
  .bss-rescan-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── bs-card reuse ── */
  :global(.bs-card) {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 18px;
  }

  /* ── Card label shared ── */
  .bss-card-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.1em;
    color: #4A4A50;
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  /* ── COLOR PALETTE ── */
  .bss-palette-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .bss-swatch-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 52px;
  }
  .bss-swatch {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    border: 2px solid;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    flex-shrink: 0;
  }
  .bss-swatch-name {
    font-size: 9px;
    color: #8A8A92;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    text-align: center;
    max-width: 56px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bss-swatch-hex {
    font-size: 8px;
    color: #4A4A50;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    text-align: center;
  }

  /* ── TYPOGRAPHY ── */
  .bss-type-specimen { display: flex; flex-direction: column; gap: 6px; }
  .bss-type-tag {
    display: inline-block;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.06em;
    color: #6A6A72;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 4px;
    padding: 2px 6px;
    align-self: flex-start;
  }
  .bss-type-tag--accent { color: #E8833A; border-color: rgba(232,131,58,0.25); background: rgba(232,131,58,0.05); }
  .bss-type-sample--heading { font-size: 22px; font-weight: 700; color: #EDEDEF; line-height: 1.2; }
  .bss-type-sample--body    { font-size: 13px; color: #8A8A92; line-height: 1.4; }
  .bss-type-sample--mono    { font-size: 12px; color: #6A6A72; font-family: monospace; line-height: 1.4; }
  .bss-type-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .bss-chip {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.05em;
    color: #6A6A72;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 3px;
    padding: 2px 5px;
  }
  .bss-chip--source { color: #4A4A50; }

  /* ── LOGO SYSTEM ── */
  .bss-logo-variants {
    display: flex;
    gap: 12px;
    margin-bottom: 10px;
  }
  .bss-logo-square {
    flex: 1;
    aspect-ratio: 1;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .bss-logo-square--dark  { background: #111114; border: 1px solid rgba(255,255,255,0.08); }
  .bss-logo-square--light { background: #EDEDEF; border: 1px solid rgba(0,0,0,0.08); }
  .bss-logo-variant-img   { max-width: 70%; max-height: 70%; object-fit: contain; }
  .bss-logo-initial {
    font-size: 28px;
    font-weight: 700;
    color: #E8833A;
    font-family: 'PP Mori', 'Geist Variable', 'Inter', -apple-system, sans-serif;
  }
  .bss-logo-initial--dark { color: #1a1a2e; }
  .bss-logo-caption {
    text-align: center;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.1em;
    color: #4A4A50;
    text-transform: uppercase;
  }

  /* ── APPLICATION EXAMPLES ── */
  .bss-apps-row {
    grid-column: 1 / -1;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 18px;
  }
  .bss-apps-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .bss-app-card { display: flex; flex-direction: column; gap: 8px; }
  .bss-app-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.1em;
    color: #4A4A50;
    text-transform: uppercase;
  }
  .bss-app-body {
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 8px;
  }
  .bss-app-body--square { aspect-ratio: 1 / 1; }
  .bss-app-body--bc     { aspect-ratio: 1.6 / 1; }
  .bss-app-body--web    { aspect-ratio: 3 / 1; }
  .bss-app-body--banner { aspect-ratio: 16 / 9; }
  .bss-app-desc {
    font-size: 9px;
    color: rgba(255,255,255,0.7);
    text-align: center;
    line-height: 1.4;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    letter-spacing: 0.03em;
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 900px) {
    .bss-grid {
      grid-template-columns: 1fr;
    }
    .bss-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .bss-apps-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
