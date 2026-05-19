<script lang="ts">
  import type { CreatorInviteAnalysis, RosterProfileSnapshot } from '$lib/types/creator-invite';
  import { avatarGradient, formatFollowersDisplay } from '$lib/utils/rosterActions';

  export let snapshot: RosterProfileSnapshot;
  export let analysis: CreatorInviteAnalysis;
  export let compact = false;
  export let rosterStatus: 'prospect' | 'on_platform' | null = null;
  export let deliveryStatus: string | null = null;
  export let selectable = false;
  export let selected = false;

  $: fitPct = analysis.fitScore != null ? Math.min(100, Math.max(0, analysis.fitScore)) : null;
  $: followerDisplay = formatFollowersDisplay(snapshot.followersCount, snapshot.followers);
  $: tags = [
    ...(snapshot.vibeTags ?? []),
    ...(snapshot.contentTags ?? []).filter((t) => !(snapshot.vibeTags ?? []).includes(t)),
  ].slice(0, compact ? 4 : 8);
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="cb"
  class:cb--compact={compact}
  class:cb--selectable={selectable}
  class:cb--selected={selected}
  role={selectable ? 'button' : undefined}
  tabindex={selectable ? 0 : undefined}
  on:click
  on:keydown
>
  <div class="cb-grid">
    <div class="cb-hero">
      <div class="cb-avatar-wrap">
        {#if snapshot.profilePicture}
          <img src={snapshot.profilePicture} alt="" class="cb-avatar-img" />
        {:else}
          <div
            class="cb-avatar-fallback"
            style="background: {avatarGradient(snapshot.displayName)}"
          >
            {snapshot.displayName.charAt(0).toUpperCase()}
          </div>
        {/if}
      </div>
      <div class="cb-hero-text">
        <p class="cb-name">{snapshot.displayName}</p>
        <p class="cb-handle">@{snapshot.handle}</p>
        {#if snapshot.location && !compact}
          <p class="cb-location">{snapshot.location}</p>
        {/if}
      </div>
      <div class="cb-badges">
        <span class="cb-fit">{analysis.fitLabel}</span>
        {#if rosterStatus}
          <span class="cb-status" class:cb-status--on={rosterStatus === 'on_platform'}>
            {rosterStatus === 'on_platform' ? 'On Wagwan' : 'Prospect'}
          </span>
        {/if}
        {#if deliveryStatus}
          <span class="cb-delivery"
            >{deliveryStatus === 'sent_manual'
              ? 'Sent'
              : deliveryStatus === 'copied'
                ? 'Copied'
                : 'Draft'}</span
          >
        {/if}
      </div>
    </div>

    <div class="cb-stat">
      <span class="cb-stat-num">{followerDisplay}</span>
      <span class="cb-stat-label">Followers</span>
    </div>
    <div class="cb-stat">
      <span class="cb-stat-num">{snapshot.posts || '—'}</span>
      <span class="cb-stat-label">Posts</span>
    </div>
    <div class="cb-stat cb-stat--fit">
      {#if fitPct != null}
        <div class="cb-fit-bar" aria-hidden="true">
          <span class="cb-fit-fill" style="width: {fitPct}%"></span>
        </div>
        <span class="cb-stat-num cb-stat-num--sm">{fitPct}</span>
        <span class="cb-stat-label">Fit score</span>
      {:else}
        <span class="cb-stat-num cb-stat-num--sm">—</span>
        <span class="cb-stat-label">Limited data</span>
      {/if}
    </div>
    <div class="cb-stat">
      <span class="cb-stat-num cb-stat-num--sm">{snapshot.following || '—'}</span>
      <span class="cb-stat-label">Following</span>
      <span class="cb-verified">{snapshot.isVerified ? 'Verified' : 'Not verified'}</span>
    </div>

    {#if !compact}
      <div class="cb-wide">
        <p class="cb-summary">{analysis.summary}</p>
      </div>

      <div class="cb-split">
        {#if analysis.highlights?.length}
          <ul class="cb-highlights">
            {#each analysis.highlights as h}
              <li>{h}</li>
            {/each}
          </ul>
        {/if}
        <div class="cb-side">
          {#if snapshot.archetype}
            <p class="cb-archetype">&ldquo;{snapshot.archetype}&rdquo;</p>
          {/if}
          {#if tags.length}
            <div class="cb-tags">
              {#each tags as tag}
                <span class="cb-tag">{tag}</span>
              {/each}
            </div>
          {/if}
          {#if snapshot.colorPalette?.length}
            <div class="cb-palette">
              {#each snapshot.colorPalette as color}
                <span class="cb-swatch" style="background: {color}" title={color}></span>
              {/each}
            </div>
          {/if}
          {#if snapshot.engagementTier}
            <span class="cb-tier">{snapshot.engagementTier}</span>
          {/if}
          {#if snapshot.strengthLabel}
            <span class="cb-signal">{snapshot.strengthLabel} signal</span>
          {/if}
        </div>
      </div>
    {:else}
      <div class="cb-wide cb-wide--compact">
        <p class="cb-summary">{analysis.summary}</p>
      </div>
    {/if}

    {#if analysis.signals?.length && !compact}
      <div class="cb-signals">
        {#each analysis.signals.slice(0, 6) as sig}
          <span class="cb-chip"><span class="cb-chip-k">{sig.label}</span> {sig.value}</span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .cb {
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    padding: 14px;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .cb--selectable {
    cursor: pointer;
  }

  .cb--selectable:hover {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.05);
  }

  .cb--selected {
    border-color: rgba(201, 184, 150, 0.45);
    background: rgba(201, 184, 150, 0.06);
  }

  .cb--compact {
    padding: 12px;
  }

  .cb-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .cb--compact .cb-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .cb-hero {
    grid-column: 1 / -1;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .cb-avatar-wrap {
    flex-shrink: 0;
  }

  .cb-avatar-img,
  .cb-avatar-fallback {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
  }

  .cb--compact .cb-avatar-img,
  .cb--compact .cb-avatar-fallback {
    width: 40px;
    height: 40px;
  }

  .cb-avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 16px;
    color: #2a2a30;
  }

  .cb-hero-text {
    flex: 1;
    min-width: 0;
  }

  .cb-name {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #ededef;
    line-height: 1.2;
  }

  .cb-handle {
    margin: 2px 0 0;
    font-size: 12px;
    color: #6b6b72;
  }

  .cb-location {
    margin: 4px 0 0;
    font-size: 11px;
    color: #4a4a50;
  }

  .cb-badges {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }

  .cb-fit {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #c9b896;
  }

  .cb-status,
  .cb-delivery {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #8b8b94;
  }

  .cb-status--on {
    color: #a8d4a0;
    background: rgba(120, 180, 100, 0.12);
  }

  .cb-stat {
    padding: 10px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cb--compact .cb-stat:nth-child(n + 4) {
    display: none;
  }

  .cb-stat-num {
    font-size: 18px;
    font-weight: 600;
    color: #ededef;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .cb-stat-num--sm {
    font-size: 14px;
  }

  .cb-stat-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4a4a50;
  }

  .cb-fit-bar {
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
    margin-bottom: 4px;
  }

  .cb-fit-fill {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #6b8cff, #c9b896);
    border-radius: 2px;
  }

  .cb-verified {
    font-size: 9px;
    color: #6b6b72;
    margin-top: 2px;
  }

  .cb-wide {
    grid-column: 1 / -1;
  }

  .cb-summary {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: #b8b8be;
  }

  .cb-split {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  @media (max-width: 640px) {
    .cb-split {
      grid-template-columns: 1fr;
    }
    .cb-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .cb-highlights {
    margin: 0;
    padding-left: 16px;
    font-size: 12px;
    color: #6b6b72;
    line-height: 1.45;
  }

  .cb-side {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cb-archetype {
    margin: 0;
    font-size: 12px;
    font-style: italic;
    color: #8b8b94;
  }

  .cb-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .cb-tag {
    font-size: 10px;
    padding: 3px 7px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #8b8b94;
  }

  .cb-palette {
    display: flex;
    gap: 6px;
  }

  .cb-swatch {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .cb-tier,
  .cb-signal {
    font-size: 10px;
    color: #6b6b72;
  }

  .cb-signals {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cb-chip {
    font-size: 10px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    color: #8b8b94;
  }

  .cb-chip-k {
    color: #4a4a50;
    font-weight: 600;
  }
</style>
