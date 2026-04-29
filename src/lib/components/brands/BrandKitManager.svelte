<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher<{ back: void }>();

  interface BrandAsset {
    id: string;
    type: string;
    variant: string | null;
    format: string;
    url: string;
    metadata: { originalName?: string; size?: number; license_attested?: boolean };
    is_default: boolean;
    created_at: string;
  }

  let assets: BrandAsset[] = [];
  let loading = true;
  let error = '';
  let uploading = false;
  let uploadError = '';
  let licenseAttested = false;
  let dragOverLogo = false;
  let dragOverFont = false;
  let dragOverMoodboard = false;

  $: logos = assets.filter(a => a.type === 'logo_primary' || a.type === 'logo_mark');
  $: fonts = assets.filter(a => a.type === 'font_file');
  $: moodboard = assets.filter(a => a.type === 'moodboard');

  onMount(loadAssets);

  async function loadAssets() {
    loading = true;
    try {
      const res = await fetch('/api/brand/brand-assets', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load assets');
      const data = await res.json();
      assets = data.assets || [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  async function uploadFile(file: File, type: string) {
    uploading = true;
    uploadError = '';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('isDefault', logos.length === 0 && type.startsWith('logo') ? 'true' : 'false');
    if (type === 'font_file') {
      formData.append('licenseAttested', String(licenseAttested));
    }
    try {
      const res = await fetch('/api/brand/brand-assets', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || `Upload failed (${res.status})`);
      }
      await loadAssets();
      licenseAttested = false;
    } catch (e) {
      uploadError = e instanceof Error ? e.message : 'Upload failed';
    } finally {
      uploading = false;
    }
  }

  async function deleteAsset(id: string) {
    try {
      const res = await fetch('/api/brand/brand-assets', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      assets = assets.filter(a => a.id !== id);
    } catch (e) {
      uploadError = e instanceof Error ? e.message : 'Delete failed';
    }
  }

  async function setDefault(asset: BrandAsset) {
    // Optimistic update
    assets = assets.map(a => ({
      ...a,
      is_default: a.type === asset.type ? a.id === asset.id : a.is_default,
    }));
    try {
      const res = await fetch('/api/brand/brand-assets', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, isDefault: true }),
      });
      if (!res.ok) throw new Error('Failed to set default');
    } catch (e) {
      // Roll back optimistic update on failure
      await loadAssets();
      uploadError = e instanceof Error ? e.message : 'Failed to set default';
    }
  }

  function handleLogoDrop(e: DragEvent) {
    e.preventDefault();
    dragOverLogo = false;
    const files = e.dataTransfer?.files;
    if (files?.length) uploadFile(files[0], 'logo_primary');
  }

  function handleFontDrop(e: DragEvent) {
    e.preventDefault();
    dragOverFont = false;
    const files = e.dataTransfer?.files;
    if (files?.length) uploadFile(files[0], 'font_file');
  }

  function handleLogoFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) uploadFile(input.files[0], 'logo_primary');
  }

  function handleFontFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) uploadFile(input.files[0], 'font_file');
  }

  function handleMoodboardDrop(e: DragEvent) {
    e.preventDefault();
    dragOverMoodboard = false;
    if (moodboard.length >= 8) return;
    const files = e.dataTransfer?.files;
    if (files?.length) uploadFile(files[0], 'moodboard');
  }

  function handleMoodboardFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0] && moodboard.length < 8) uploadFile(input.files[0], 'moodboard');
  }

  function formatBytes(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
</script>

<div class="bkm">
  <!-- Header -->
  <div class="bkm-header">
    <button class="bkm-back" on:click={() => dispatch('back')}>← Back</button>
    <div class="bkm-header-text">
      <h2 class="bkm-title">Brand Kit Manager</h2>
      <p class="bkm-subtitle">Upload your logos and fonts for AI-generated creatives</p>
    </div>
  </div>

  {#if error}
    <div class="bkm-error">{error}</div>
  {/if}

  {#if uploadError}
    <div class="bkm-error">{uploadError} <button class="bkm-error-dismiss" on:click={() => (uploadError = '')}>×</button></div>
  {/if}

  <!-- Logos Section -->
  <div class="bkm-section">
    <div class="bkm-section-header">
      <span class="bkm-label">LOGOS</span>
      <span class="bkm-section-hint">SVG or PNG — will be composited onto your creatives</span>
    </div>

    <!-- Upload zone -->
    <div
      class="bkm-drop-zone"
      class:bkm-drop-zone--active={dragOverLogo}
      on:dragover|preventDefault={() => (dragOverLogo = true)}
      on:dragleave={() => (dragOverLogo = false)}
      on:drop={handleLogoDrop}
      role="button"
      tabindex="0"
    >
      <div class="bkm-drop-icon">◈</div>
      <div class="bkm-drop-title">Drop your logo here</div>
      <div class="bkm-drop-hint">SVG or PNG — transparent background recommended</div>
      <label class="bkm-browse-btn">
        Browse files
        <input type="file" accept=".svg,.png,image/svg+xml,image/png" on:change={handleLogoFile} style="display:none" />
      </label>
    </div>

    <!-- Logo grid -->
    {#if loading}
      <div class="bkm-loading">Loading assets...</div>
    {:else if logos.length > 0}
      <div class="bkm-asset-grid">
        {#each logos as asset}
          <div class="bkm-asset-card">
            <div class="bkm-asset-preview">
              <img src={asset.url} alt={asset.metadata.originalName || 'Logo'} />
            </div>
            <div class="bkm-asset-info">
              <div class="bkm-asset-name">{asset.metadata.originalName || 'Logo'}</div>
              <div class="bkm-asset-meta">
                <span class="bkm-badge bkm-badge--format">{asset.format.toUpperCase()}</span>
                {#if asset.metadata.size}
                  <span class="bkm-asset-size">{formatBytes(asset.metadata.size)}</span>
                {/if}
              </div>
            </div>
            <div class="bkm-asset-actions">
              {#if asset.is_default}
                <span class="bkm-badge bkm-badge--default">Default</span>
              {:else}
                <button class="bkm-set-default" on:click={() => setDefault(asset)}>Set default</button>
              {/if}
              <button class="bkm-delete" on:click={() => deleteAsset(asset.id)} title="Delete">×</button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="bkm-empty">
        <div class="bkm-empty-icon">◈</div>
        <div class="bkm-empty-text">No logos uploaded yet — upload your logo to get started</div>
      </div>
    {/if}
  </div>

  <!-- Fonts Section -->
  <div class="bkm-section">
    <div class="bkm-section-header">
      <span class="bkm-label">FONTS</span>
      <span class="bkm-section-hint">WOFF2, TTF, or OTF — used for composited text overlays</span>
    </div>

    <!-- License attestation -->
    <label class="bkm-license">
      <input type="checkbox" bind:checked={licenseAttested} />
      <span>I have a valid license to use this font commercially</span>
    </label>

    <!-- Upload zone -->
    <div
      class="bkm-drop-zone"
      class:bkm-drop-zone--active={dragOverFont}
      class:bkm-drop-zone--disabled={!licenseAttested}
      on:dragover|preventDefault={() => licenseAttested && (dragOverFont = true)}
      on:dragleave={() => (dragOverFont = false)}
      on:drop={licenseAttested ? handleFontDrop : undefined}
      role="button"
      tabindex="0"
    >
      <div class="bkm-drop-icon">Aa</div>
      <div class="bkm-drop-title">Drop your font file here</div>
      <div class="bkm-drop-hint">WOFF2, TTF, or OTF — {licenseAttested ? 'license attested' : 'confirm license above first'}</div>
      {#if licenseAttested}
        <label class="bkm-browse-btn">
          Browse files
          <input type="file" accept=".woff2,.ttf,.otf,font/woff2,font/ttf,font/otf" on:change={handleFontFile} style="display:none" />
        </label>
      {/if}
    </div>

    <!-- Font list -->
    {#if loading}
      <div class="bkm-loading">Loading assets...</div>
    {:else if fonts.length > 0}
      <div class="bkm-asset-list">
        {#each fonts as asset}
          <div class="bkm-asset-row">
            <div class="bkm-font-icon">Aa</div>
            <div class="bkm-asset-info">
              <div class="bkm-asset-name">{asset.metadata.originalName || 'Font'}</div>
              <div class="bkm-asset-meta">
                <span class="bkm-badge bkm-badge--format">{asset.format.toUpperCase()}</span>
                {#if asset.metadata.size}
                  <span class="bkm-asset-size">{formatBytes(asset.metadata.size)}</span>
                {/if}
                {#if asset.metadata.license_attested}
                  <span class="bkm-badge bkm-badge--license">Licensed</span>
                {/if}
              </div>
            </div>
            <button class="bkm-delete" on:click={() => deleteAsset(asset.id)} title="Delete">×</button>
          </div>
        {/each}
      </div>
    {:else}
      <div class="bkm-empty">
        <div class="bkm-empty-icon">Aa</div>
        <div class="bkm-empty-text">No fonts uploaded — fonts ensure your brand typography appears in AI creatives</div>
      </div>
    {/if}
  </div>

  <!-- Moodboard Section -->
  <div class="bkm-section">
    <div class="bkm-section-header">
      <span class="bkm-label">MOODBOARD — Visual references for AI creative generation</span>
    </div>
    <div class="bkm-section-hint" style="margin-top: -4px;">Upload images that represent the visual style you want — design inspo, competitor posts, aesthetic references</div>

    <!-- Upload zone -->
    {#if moodboard.length < 8}
      <div
        class="bkm-drop-zone"
        class:bkm-drop-zone--active={dragOverMoodboard}
        on:dragover|preventDefault={() => (dragOverMoodboard = true)}
        on:dragleave={() => (dragOverMoodboard = false)}
        on:drop={handleMoodboardDrop}
        role="button"
        tabindex="0"
      >
        <div class="bkm-drop-icon">◫</div>
        <div class="bkm-drop-title">Drop reference images here</div>
        <div class="bkm-drop-hint">JPG, PNG, or WEBP — {moodboard.length}/8 uploaded</div>
        <label class="bkm-browse-btn">
          Browse files
          <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" on:change={handleMoodboardFile} style="display:none" />
        </label>
      </div>
    {:else}
      <div class="bkm-drop-zone bkm-drop-zone--disabled">
        <div class="bkm-drop-icon">◫</div>
        <div class="bkm-drop-title">Maximum 8 images reached</div>
        <div class="bkm-drop-hint">Delete an image below to upload a new one</div>
      </div>
    {/if}

    <!-- Moodboard grid -->
    {#if loading}
      <div class="bkm-loading">Loading assets...</div>
    {:else if moodboard.length > 0}
      <div class="bkm-moodboard-grid">
        {#each moodboard as asset}
          <div class="bkm-moodboard-card">
            <img src={asset.url} alt={asset.metadata.originalName || 'Moodboard image'} />
            <button class="bkm-moodboard-delete" on:click={() => deleteAsset(asset.id)} title="Remove">×</button>
          </div>
        {/each}
      </div>
    {:else}
      <div class="bkm-empty">
        <div class="bkm-empty-icon">◫</div>
        <div class="bkm-empty-text">No moodboard images yet — add visual references to guide Gemini toward the exact aesthetic you want</div>
      </div>
    {/if}
  </div>

  {#if uploading}
    <div class="bkm-uploading">
      <span class="bkm-uploading-dot"></span>
      Uploading...
    </div>
  {/if}
</div>

<style>
  .bkm {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }

  /* Header */
  .bkm-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .bkm-back {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4a4a50;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    padding: 5px 10px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .bkm-back:hover { color: #ededef; border-color: rgba(255, 255, 255, 0.15); }
  .bkm-header-text { flex: 1; }
  .bkm-title {
    font-size: 18px;
    font-weight: 700;
    color: #ededef;
    margin: 0 0 3px;
  }
  .bkm-subtitle { font-size: 12px; color: #4a4a50; margin: 0; }

  /* Errors */
  .bkm-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 9px;
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.15);
    font-size: 12px;
    color: #f87171;
  }
  .bkm-error-dismiss {
    background: none;
    border: none;
    color: #f87171;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
  }

  /* Section */
  .bkm-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 18px 20px;
  }
  .bkm-section-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .bkm-section-hint {
    font-size: 11px;
    color: #4a4a50;
  }

  .bkm-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
  }

  /* Drop zone */
  .bkm-drop-zone {
    border: 1.5px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 32px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(255, 255, 255, 0.01);
  }
  .bkm-drop-zone:hover:not(.bkm-drop-zone--disabled) {
    border-color: rgba(232, 70, 74, 0.3);
    background: rgba(232, 70, 74, 0.02);
  }
  .bkm-drop-zone--active {
    border-color: rgba(232, 70, 74, 0.5) !important;
    background: rgba(232, 70, 74, 0.04) !important;
  }
  .bkm-drop-zone--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .bkm-drop-icon { font-size: 22px; opacity: 0.3; margin-bottom: 8px; }
  .bkm-drop-title { font-size: 13px; font-weight: 600; color: #ededef; }
  .bkm-drop-hint { font-size: 11px; color: #4a4a50; margin-top: 4px; }
  .bkm-browse-btn {
    display: inline-block;
    margin-top: 12px;
    padding: 6px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #8a8a90;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .bkm-browse-btn:hover { color: #ededef; border-color: rgba(255, 255, 255, 0.15); }

  /* License */
  .bkm-license {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #8a8a90;
    cursor: pointer;
  }
  .bkm-license input { cursor: pointer; accent-color: #e8464a; }

  /* Asset grid (logos) */
  .bkm-asset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .bkm-asset-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
  }
  .bkm-asset-preview {
    width: 100%;
    aspect-ratio: 3 / 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 7px;
    overflow: hidden;
  }
  .bkm-asset-preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  /* Asset list (fonts) */
  .bkm-asset-list { display: flex; flex-direction: column; gap: 8px; }
  .bkm-asset-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 9px;
  }
  .bkm-font-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    color: #8a8a90;
    flex-shrink: 0;
    font-family: serif;
  }

  /* Shared asset info */
  .bkm-asset-info { flex: 1; min-width: 0; }
  .bkm-asset-name {
    font-size: 12px;
    font-weight: 600;
    color: #ededef;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bkm-asset-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 3px;
    flex-wrap: wrap;
  }
  .bkm-asset-size { font-size: 10px; color: #4a4a50; }

  .bkm-asset-actions {
    display: flex;
    align-items: center;
    gap: 5px;
    justify-content: space-between;
  }

  /* Badges */
  .bkm-badge {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .bkm-badge--format {
    background: rgba(255, 255, 255, 0.05);
    color: #4a4a50;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }
  .bkm-badge--default {
    background: rgba(232, 70, 74, 0.1);
    color: #e8464a;
    border: 1px solid rgba(232, 70, 74, 0.2);
  }
  .bkm-badge--license {
    background: rgba(127, 200, 169, 0.08);
    color: #7fc8a9;
    border: 1px solid rgba(127, 200, 169, 0.15);
  }

  .bkm-set-default {
    font-size: 10px;
    color: #4a4a50;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 5px;
    padding: 3px 7px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .bkm-set-default:hover { color: #ededef; border-color: rgba(255, 255, 255, 0.12); }

  .bkm-delete {
    background: none;
    border: 1px solid rgba(239, 68, 68, 0.12);
    border-radius: 5px;
    color: #4a4a50;
    font-size: 14px;
    line-height: 1;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .bkm-delete:hover { color: #f87171; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.06); }

  /* Empty states */
  .bkm-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 20px;
    text-align: center;
  }
  .bkm-empty-icon { font-size: 24px; opacity: 0.15; }
  .bkm-empty-text { font-size: 12px; color: #4a4a50; max-width: 260px; line-height: 1.5; }

  .bkm-loading { font-size: 12px; color: #4a4a50; padding: 8px 0; }

  /* Uploading indicator */
  .bkm-uploading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #e8464a;
  }
  .bkm-uploading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e8464a;
    animation: blink 1s ease-in-out infinite;
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }

  /* Moodboard grid */
  .bkm-moodboard-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .bkm-moodboard-card {
    position: relative;
    aspect-ratio: 1 / 1;
    border-radius: 9px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }
  .bkm-moodboard-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .bkm-moodboard-delete {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 13px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .bkm-moodboard-card:hover .bkm-moodboard-delete {
    opacity: 1;
  }
  .bkm-moodboard-delete:hover {
    background: rgba(239, 68, 68, 0.4);
    border-color: rgba(239, 68, 68, 0.6);
  }
</style>
