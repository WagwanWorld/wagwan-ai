<script lang="ts">
  import type { BrandCreatorRosterEntry, CreatorInviteLinks } from '$lib/types/creator-invite';
  import { avatarGradient, formatFollowersDisplay } from '$lib/utils/rosterActions';

  export let row: BrandCreatorRosterEntry;
  export let links: CreatorInviteLinks | null = null;

  $: snap = row.profile_snapshot;
  $: analysis = row.analysis_snapshot;
  $: fit = analysis.fitScore != null ? Math.min(100, Math.max(0, analysis.fitScore)) : null;
  $: fitDash = fit != null ? `${fit * 2.14} 214` : '0 214';
  $: followers = formatFollowersDisplay(snap.followersCount, snap.followers);
  $: tags = [
    ...(snap.vibeTags ?? []),
    ...(snap.contentTags ?? []).filter((t) => !(snap.vibeTags ?? []).includes(t)),
  ].slice(0, 6);
</script>

<article class="rdb">
  <div class="rdb-bento">
    <!-- Profile -->
    <div class="rdb-tile rdb-tile--profile">
      <div class="rdb-profile">
        {#if snap.profilePicture}
          <img src={snap.profilePicture} alt="" class="rdb-avatar" />
        {:else}
          <span
            class="rdb-avatar rdb-avatar--init"
            style="background: {avatarGradient(snap.displayName)}"
          >
            {snap.displayName.charAt(0).toUpperCase()}
          </span>
        {/if}
        <div class="rdb-profile-text">
          <h3 class="rdb-name">{snap.displayName}</h3>
          <a
            href={links?.instagramProfile ?? `https://www.instagram.com/${row.ig_username}/`}
            target="_blank"
            rel="noopener noreferrer"
            class="rdb-handle">@{row.ig_username}</a
          >
          {#if snap.location}
            <span class="rdb-loc">{snap.location}</span>
          {/if}
        </div>
        <div class="rdb-badges">
          <span class="rdb-badge rdb-badge--fit">{analysis.fitLabel}</span>
          <span class="rdb-badge" class:rdb-badge--on={row.status === 'on_platform'}>
            {row.status === 'on_platform' ? 'On Wagwan' : 'Prospect'}
          </span>
        </div>
      </div>
    </div>

    <!-- Stat tiles -->
    <div class="rdb-tile rdb-tile--stat">
      <span class="rdb-stat-num">{followers}</span>
      <span class="rdb-stat-lbl">Followers</span>
    </div>
    <div class="rdb-tile rdb-tile--stat">
      <span class="rdb-stat-num">{snap.posts || '—'}</span>
      <span class="rdb-stat-lbl">Posts</span>
    </div>
    <div class="rdb-tile rdb-tile--stat">
      <span class="rdb-stat-num">{snap.following || '—'}</span>
      <span class="rdb-stat-lbl">Following</span>
    </div>
    <div class="rdb-tile rdb-tile--fit">
      {#if fit != null}
        <div class="rdb-ring" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="56" height="56">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              stroke-width="3"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#c9b896"
              stroke-width="3"
              stroke-dasharray={fitDash}
              stroke-linecap="round"
              transform="rotate(-90 32 32)"
            />
            <text x="32" y="35" text-anchor="middle" fill="#ededef" font-size="14" font-weight="700"
              >{fit}</text
            >
          </svg>
        </div>
        <span class="rdb-stat-lbl">Fit score</span>
      {:else}
        <span class="rdb-stat-num rdb-stat-num--sm">—</span>
        <span class="rdb-stat-lbl">Limited data</span>
      {/if}
    </div>
    <div class="rdb-tile rdb-tile--stat">
      <span class="rdb-stat-num rdb-stat-num--sm">{snap.isVerified ? 'Yes' : 'No'}</span>
      <span class="rdb-stat-lbl">Verified</span>
    </div>
    {#if snap.engagementTier}
      <div class="rdb-tile rdb-tile--stat">
        <span class="rdb-stat-num rdb-stat-num--sm">{snap.engagementTier}</span>
        <span class="rdb-stat-lbl">Engagement</span>
      </div>
    {/if}
    {#if snap.strengthScore != null}
      <div class="rdb-tile rdb-tile--stat">
        <span class="rdb-stat-num">{snap.strengthScore}</span>
        <span class="rdb-stat-lbl">{snap.strengthLabel ?? 'Signal'}</span>
      </div>
    {/if}

    <!-- Summary -->
    <div class="rdb-tile rdb-tile--wide">
      <span class="rdb-kicker">Analysis</span>
      <p class="rdb-summary">{analysis.summary}</p>
    </div>

    <!-- Highlights + meta -->
    <div class="rdb-tile rdb-tile--half">
      <span class="rdb-kicker">Highlights</span>
      {#if analysis.highlights?.length}
        <ul class="rdb-list">
          {#each analysis.highlights as h}
            <li>{h}</li>
          {/each}
        </ul>
      {:else}
        <p class="rdb-muted">No highlights yet.</p>
      {/if}
    </div>

    <div class="rdb-tile rdb-tile--half">
      <span class="rdb-kicker">Signals</span>
      {#if snap.archetype}
        <p class="rdb-archetype">&ldquo;{snap.archetype}&rdquo;</p>
      {/if}
      {#if tags.length}
        <div class="rdb-tags">
          {#each tags as tag}
            <span class="rdb-tag">{tag}</span>
          {/each}
        </div>
      {/if}
      {#if snap.colorPalette?.length}
        <div class="rdb-palette">
          {#each snap.colorPalette as color}
            <span class="rdb-swatch" style="background: {color}" title={color}></span>
          {/each}
        </div>
      {/if}
      {#if analysis.signals?.length}
        <div class="rdb-chips">
          {#each analysis.signals.slice(0, 6) as sig}
            <span class="rdb-chip"><b>{sig.label}</b> {sig.value}</span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Sheet data (custom fields from bulk upload) -->
    {#if snap.custom_fields && Object.keys(snap.custom_fields).length > 0}
      <div class="rdb-tile rdb-tile--half" style="grid-column: span 3;">
        <span class="rdb-kicker">Sheet Data</span>
        <div class="rdb-custom-fields">
          {#each Object.entries(snap.custom_fields) as [key, value]}
            <div class="rdb-custom-field">
              <span class="rdb-custom-key">{key}</span>
              <span class="rdb-custom-val">{value}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Contact info from sheet -->
    {#if snap.email || snap.phone || snap.rates}
      <div class="rdb-tile rdb-tile--half" style="grid-column: span 3;">
        <span class="rdb-kicker">Contact</span>
        <div class="rdb-custom-fields">
          {#if snap.email}
            <div class="rdb-custom-field">
              <span class="rdb-custom-key">Email</span>
              <span class="rdb-custom-val">{snap.email}</span>
            </div>
          {/if}
          {#if snap.phone}
            <div class="rdb-custom-field">
              <span class="rdb-custom-key">Phone</span>
              <span class="rdb-custom-val">{snap.phone}</span>
            </div>
          {/if}
          {#if snap.rates}
            <div class="rdb-custom-field">
              <span class="rdb-custom-key">Rates</span>
              <span class="rdb-custom-val">{snap.rates}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</article>

<style>
  .rdb-bento {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px;
  }

  @media (max-width: 900px) {
    .rdb-bento {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .rdb-bento {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .rdb-tile {
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.03);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    min-height: 72px;
  }

  .rdb-tile--profile {
    grid-column: span 2;
    min-height: 88px;
  }

  @media (max-width: 900px) {
    .rdb-tile--profile {
      grid-column: span 3;
    }
  }

  @media (max-width: 520px) {
    .rdb-tile--profile {
      grid-column: span 2;
    }
  }

  .rdb-tile--wide {
    grid-column: 1 / -1;
  }

  .rdb-tile--half {
    grid-column: span 3;
  }

  @media (max-width: 900px) {
    .rdb-tile--half {
      grid-column: span 3;
    }
  }

  @media (max-width: 520px) {
    .rdb-tile--half {
      grid-column: span 2;
    }
  }

  .rdb-tile--fit {
    align-items: center;
    text-align: center;
  }

  .rdb-tile--stat {
    align-items: flex-start;
  }

  .rdb-profile {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
  }

  .rdb-avatar {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .rdb-avatar--init {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    color: #2a2a30;
  }

  .rdb-profile-text {
    flex: 1;
    min-width: 0;
  }

  .rdb-name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #ededef;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .rdb-handle {
    font-size: 12px;
    color: #6b8cff;
    text-decoration: none;
  }

  .rdb-handle:hover {
    text-decoration: underline;
  }

  .rdb-loc {
    display: block;
    font-size: 11px;
    color: #4a4a50;
    margin-top: 2px;
  }

  .rdb-badges {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .rdb-badge {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #8b8b94;
    white-space: nowrap;
  }

  .rdb-badge--fit {
    color: #c9b896;
    background: rgba(201, 184, 150, 0.12);
  }

  .rdb-badge--on {
    color: #a8d4a0;
    background: rgba(120, 180, 100, 0.12);
  }

  .rdb-stat-num {
    font-size: 22px;
    font-weight: 600;
    color: #ededef;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  .rdb-stat-num--sm {
    font-size: 15px;
  }

  .rdb-stat-lbl {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .rdb-ring {
    line-height: 0;
    margin: 0 auto 2px;
  }

  .rdb-kicker {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
    margin-bottom: 6px;
  }

  .rdb-summary {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: #b8b8be;
  }

  .rdb-list {
    margin: 0;
    padding-left: 16px;
    font-size: 12px;
    color: #8b8b94;
    line-height: 1.5;
  }

  .rdb-muted {
    margin: 0;
    font-size: 12px;
    color: #4a4a50;
  }

  .rdb-archetype {
    margin: 0 0 8px;
    font-size: 12px;
    font-style: italic;
    color: #8b8b94;
  }

  .rdb-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }

  .rdb-tag {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #8b8b94;
  }

  .rdb-palette {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }

  .rdb-swatch {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .rdb-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .rdb-chip {
    font-size: 10px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
    color: #6b6b72;
  }

  .rdb-chip b {
    color: #4a4a50;
    font-weight: 600;
  }

  .rdb-custom-fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rdb-custom-field {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .rdb-custom-key {
    font-size: 10px;
    color: rgba(255, 248, 232, 0.35);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .rdb-custom-val {
    font-size: 12px;
    color: rgba(255, 248, 232, 0.7);
    text-align: right;
    word-break: break-word;
  }
</style>
