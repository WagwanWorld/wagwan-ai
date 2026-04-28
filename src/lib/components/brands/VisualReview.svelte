<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let imageUrl: string = '';
  export let concept: string = '';
  export let designDirection: string = '';
  export let whyThisWorks: string[] = [];
  export let caption: string = '';
  export let hashtags: string[] = [];
  export let qcReport: {
    textLegible: boolean;
    logoOk: boolean;
    paletteOk: boolean;
    safeZoneOk: boolean;
    issues: string[];
    passed: boolean;
  } | null = null;
  export let version: number = 1;
  export let format: string = 'static_4x5';
  export let cost: { total_usd: number } | null = null;

  const dispatch = createEventDispatcher<{
    approve: void;
    revise: void;
    regenerate: void;
    download: void;
  }>();

  let qcExpanded = false;

  async function handleDownload() {
    if (imageUrl) {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `creative-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } catch {
        // fallback: open in new tab
        window.open(imageUrl, '_blank');
      }
    }
    dispatch('download');
  }

  $: qcPassed = qcReport?.passed ?? true;
  $: qcIssues = qcReport?.issues ?? [];
  $: qcHasIssues = qcIssues.length > 0 && !qcPassed;

  $: hashtagString = hashtags.map(h => `#${h}`).join(' ');
</script>

<div class="vr">
  <!-- Version badge row -->
  <div class="vr-topbar">
    <span class="vr-version">V{version}</span>
    {#if format}
      <span class="vr-format">{format.replace(/_/g, ' ').toUpperCase()}</span>
    {/if}
    {#if cost}
      <span class="vr-cost">${cost.total_usd.toFixed(3)}</span>
    {/if}
    <div class="vr-topbar-spacer"></div>
    <button class="vr-download-btn" on:click={handleDownload} title="Download PNG">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Download
    </button>
  </div>

  <!-- Image preview -->
  <div class="vr-image-wrap">
    {#if imageUrl}
      <img class="vr-image" src={imageUrl} alt="Generated creative V{version}" />
    {:else}
      <div class="vr-image-placeholder">
        <div class="vr-placeholder-icon">✦</div>
        <div class="vr-placeholder-text">No image generated</div>
      </div>
    {/if}

    <!-- QC badge overlay -->
    {#if qcReport}
      <button
        class="vr-qc-badge"
        class:vr-qc-badge--pass={qcPassed}
        class:vr-qc-badge--warn={!qcPassed}
        on:click={() => (qcExpanded = !qcExpanded)}
        title="QC Report"
      >
        {#if qcPassed}
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5l2.5 2.5L9 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          QC Pass
        {:else}
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 2v4M5.5 8.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          QC Issues
        {/if}
      </button>
    {/if}
  </div>

  <!-- QC expanded panel -->
  {#if qcExpanded && qcReport}
    <div class="vr-qc-panel">
      <span class="vr-label">QC REPORT</span>
      <div class="vr-qc-checks">
        <div class="vr-qc-check" class:vr-qc-check--pass={qcReport.textLegible} class:vr-qc-check--fail={!qcReport.textLegible}>
          <span class="vr-qc-dot"></span>Text legibility
        </div>
        <div class="vr-qc-check" class:vr-qc-check--pass={qcReport.logoOk} class:vr-qc-check--fail={!qcReport.logoOk}>
          <span class="vr-qc-dot"></span>Logo placement
        </div>
        <div class="vr-qc-check" class:vr-qc-check--pass={qcReport.paletteOk} class:vr-qc-check--fail={!qcReport.paletteOk}>
          <span class="vr-qc-dot"></span>Palette accuracy
        </div>
        <div class="vr-qc-check" class:vr-qc-check--pass={qcReport.safeZoneOk} class:vr-qc-check--fail={!qcReport.safeZoneOk}>
          <span class="vr-qc-dot"></span>Safe zone
        </div>
      </div>
      {#if qcHasIssues}
        <div class="vr-qc-issues">
          {#each qcIssues as issue}
            <div class="vr-qc-issue">{issue}</div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Concept card -->
  {#if concept}
    <div class="vr-card">
      <span class="vr-label">CONCEPT</span>
      <p class="vr-concept-text">{concept}</p>
    </div>
  {/if}

  <!-- Design direction -->
  {#if designDirection}
    <div class="vr-card">
      <span class="vr-label">DESIGN DIRECTION</span>
      <p class="vr-direction-text">{designDirection}</p>
    </div>
  {/if}

  <!-- Why this works -->
  {#if whyThisWorks.length > 0}
    <div class="vr-card">
      <span class="vr-label">WHY THIS WORKS</span>
      <ul class="vr-why-list">
        {#each whyThisWorks as point}
          <li class="vr-why-item">
            <span class="vr-why-bullet">—</span>
            <span>{point}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Caption preview -->
  {#if caption}
    <div class="vr-card">
      <span class="vr-label">CAPTION PREVIEW</span>
      <div class="vr-caption-box">
        <p class="vr-caption-text">{caption}</p>
        {#if hashtagString}
          <p class="vr-hashtags">{hashtagString}</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Action buttons -->
  <div class="vr-actions">
    <button class="vr-btn vr-btn--ghost" on:click={() => dispatch('regenerate')}>
      Regenerate
    </button>
    <button class="vr-btn vr-btn--ghost" on:click={() => dispatch('revise')}>
      Revise
    </button>
    <button class="vr-btn vr-btn--primary" on:click={() => dispatch('approve')}>
      Approve &amp; Schedule
    </button>
  </div>
</div>

<style>
  .vr {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
  }

  /* Top bar */
  .vr-topbar {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .vr-topbar-spacer { flex: 1; }

  .vr-version {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #e8464a;
    padding: 3px 8px;
    border-radius: 5px;
    background: rgba(232, 70, 74, 0.1);
    border: 1px solid rgba(232, 70, 74, 0.2);
  }

  .vr-format {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: #4a4a50;
    text-transform: uppercase;
  }

  .vr-cost {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    color: #4a4a50;
  }

  .vr-download-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #8a8a90;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s;
  }
  .vr-download-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.12);
  }

  /* Image */
  .vr-image-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 5;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.02);
  }

  .vr-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .vr-image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .vr-placeholder-icon {
    font-size: 32px;
    opacity: 0.15;
  }
  .vr-placeholder-text {
    font-size: 12px;
    color: #4a4a50;
  }

  /* QC badge on image */
  .vr-qc-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 9px;
    border-radius: 20px;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    backdrop-filter: blur(8px);
  }
  .vr-qc-badge--pass {
    background: rgba(127, 200, 169, 0.2);
    color: #7fc8a9;
    border: 1px solid rgba(127, 200, 169, 0.25);
  }
  .vr-qc-badge--warn {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }
  .vr-qc-badge:hover {
    filter: brightness(1.15);
  }

  /* QC expanded panel */
  .vr-qc-panel {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .vr-qc-checks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .vr-qc-check {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #8a8a90;
  }
  .vr-qc-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #4a4a50;
  }
  .vr-qc-check--pass .vr-qc-dot { background: #7fc8a9; }
  .vr-qc-check--pass { color: #7fc8a9; }
  .vr-qc-check--fail .vr-qc-dot { background: #f59e0b; }
  .vr-qc-check--fail { color: #f59e0b; }

  .vr-qc-issues {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .vr-qc-issue {
    font-size: 11px;
    color: #f59e0b;
    padding: 4px 8px;
    background: rgba(245, 158, 11, 0.06);
    border-radius: 5px;
  }

  /* Shared card */
  .vr-card {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vr-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .vr-concept-text {
    margin: 0;
    font-size: 13px;
    color: #ededef;
    line-height: 1.6;
  }

  .vr-direction-text {
    margin: 0;
    font-size: 12px;
    color: #8a8a90;
    line-height: 1.55;
  }

  /* Why this works */
  .vr-why-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .vr-why-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    color: #8a8a90;
    line-height: 1.5;
  }
  .vr-why-bullet {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    color: #e8464a;
    font-size: 12px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* Caption */
  .vr-caption-box {
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .vr-caption-text {
    margin: 0;
    font-size: 12px;
    color: #ededef;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .vr-hashtags {
    margin: 8px 0 0;
    font-size: 11px;
    color: #4a7fc8;
    line-height: 1.5;
    word-break: break-word;
  }

  /* Action buttons */
  .vr-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 4px;
  }

  .vr-btn {
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .vr-btn--primary {
    background: rgba(232, 70, 74, 0.15);
    border: 1px solid rgba(232, 70, 74, 0.3);
    color: #e8464a;
  }
  .vr-btn--primary:hover {
    background: rgba(232, 70, 74, 0.22);
    border-color: rgba(232, 70, 74, 0.45);
  }
  .vr-btn--ghost {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #8a8a90;
  }
  .vr-btn--ghost:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.12);
  }

  @media (max-width: 540px) {
    .vr-actions {
      flex-direction: column;
    }
    .vr-btn {
      width: 100%;
      text-align: center;
    }
  }
</style>
