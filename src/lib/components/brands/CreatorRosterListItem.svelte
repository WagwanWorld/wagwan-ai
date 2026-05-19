<script lang="ts">
  import type { BrandCreatorRosterEntry } from '$lib/types/creator-invite';
  import { avatarGradient, formatFollowersDisplay } from '$lib/utils/rosterActions';

  export let row: BrandCreatorRosterEntry;
  export let selected = false;

  $: snap = row.profile_snapshot;
  $: analysis = row.analysis_snapshot;
  $: followers = formatFollowersDisplay(snap.followersCount, snap.followers);
  $: fit = analysis.fitScore;
  $: delivery =
    row.delivery_status === 'sent_manual'
      ? 'Sent'
      : row.delivery_status === 'copied'
        ? 'Copied'
        : 'Draft';
</script>

<button type="button" class="crl" class:crl--selected={selected} on:click>
  <div class="crl-avatar" aria-hidden="true">
    {#if snap.profilePicture}
      <img src={snap.profilePicture} alt="" class="crl-avatar-img" />
    {:else}
      <span class="crl-avatar-fallback" style="background: {avatarGradient(snap.displayName)}">
        {snap.displayName.charAt(0).toUpperCase()}
      </span>
    {/if}
  </div>

  <div class="crl-main">
    <div class="crl-top">
      <span class="crl-name">{snap.displayName}</span>
      <span class="crl-handle">@{row.ig_username}</span>
    </div>
    <div class="crl-pills">
      <span class="crl-pill crl-pill--fit">{analysis.fitLabel}</span>
      <span class="crl-pill" class:crl-pill--on={row.status === 'on_platform'}>
        {row.status === 'on_platform' ? 'On Wagwan' : 'Prospect'}
      </span>
      <span class="crl-pill crl-pill--muted">{delivery}</span>
    </div>
  </div>

  <div class="crl-stats" aria-hidden="true">
    <div class="crl-stat">
      <span class="crl-stat-val">{followers}</span>
      <span class="crl-stat-lbl">Followers</span>
    </div>
    <div class="crl-stat">
      <span class="crl-stat-val">{snap.posts || '—'}</span>
      <span class="crl-stat-lbl">Posts</span>
    </div>
    <div class="crl-stat">
      <span class="crl-stat-val">{fit != null ? fit : '—'}</span>
      <span class="crl-stat-lbl">Fit</span>
    </div>
    <div class="crl-stat crl-stat--hide-sm">
      <span class="crl-stat-val">{snap.following || '—'}</span>
      <span class="crl-stat-lbl">Following</span>
    </div>
  </div>

  <svg
    class="crl-chevron"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M6 4l4 4-4 4"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</button>

<style>
  .crl {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    cursor: pointer;
    text-align: left;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      transform 0.15s ease;
  }

  .crl:hover {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
  }

  .crl--selected {
    border-color: rgba(201, 184, 150, 0.35);
    background: rgba(201, 184, 150, 0.06);
  }

  .crl-avatar {
    flex-shrink: 0;
  }

  .crl-avatar-img,
  .crl-avatar-fallback {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    object-fit: cover;
    display: block;
  }

  .crl-avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    color: #2a2a30;
  }

  .crl-main {
    flex: 1;
    min-width: 0;
  }

  .crl-top {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .crl-name {
    font-size: 14px;
    font-weight: 600;
    color: #ededef;
    letter-spacing: -0.02em;
  }

  .crl-handle {
    font-size: 12px;
    color: #6b6b72;
  }

  .crl-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .crl-pill {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    color: #8b8b94;
  }

  .crl-pill--fit {
    color: #c9b896;
    background: rgba(201, 184, 150, 0.1);
  }

  .crl-pill--on {
    color: #a8d4a0;
    background: rgba(120, 180, 100, 0.12);
  }

  .crl-pill--muted {
    color: #4a4a50;
  }

  .crl-stats {
    display: flex;
    gap: 20px;
    flex-shrink: 0;
  }

  @media (max-width: 720px) {
    .crl-stat--hide-sm {
      display: none;
    }
    .crl-stats {
      gap: 12px;
    }
  }

  .crl-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    min-width: 48px;
  }

  .crl-stat-val {
    font-size: 15px;
    font-weight: 600;
    color: #ededef;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .crl-stat-lbl {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .crl-chevron {
    flex-shrink: 0;
    color: #4a4a50;
  }

  .crl--selected .crl-chevron {
    color: #c9b896;
  }
</style>
