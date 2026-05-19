<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
  import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';

  type Member = {
    user_google_sub: string;
    name: string;
    status: string;
    accepted_at: string | null;
    live_at: string | null;
    completed_at: string | null;
    ig_post_url: string | null;
  };

  type Campaign = {
    id: string;
    title: string;
    brand_name: string;
    status: string;
    reward_inr: number;
    creative_text: string;
    created_at: string;
    counts: Record<string, number>;
    members: Member[];
    creatives?: Array<{
      id: string;
      media_type: 'image' | 'video';
      url: string;
      thumb_url?: string | null;
      caption?: string | null;
    }>;
  };

  let campaigns: Campaign[] = [];
  let loading = true;
  let error = '';
  let expandedId: string | null = null;
  let actionBusy = '';
  let editingId: string | null = null;
  let editTitle = '';
  let editReward = 0;
  let editSaving = false;

  let createPanelOpen = false;
  let newTitle = '';
  let newCreativeText = '';
  let newRewardInr = 50;
  let channelEmail = false;
  let channelInApp = true;
  let createBusy = false;
  let createMsg = '';

  $: brandName =
    $page.data.brandAccount?.ig_name?.trim() ||
    $page.data.brandAccount?.ig_username?.trim() ||
    'Brand';

  function startEdit(c: Campaign) {
    editingId = c.id;
    editTitle = c.title;
    editReward = c.reward_inr;
  }

  function cancelEdit() {
    editingId = null;
  }

  function openCreateFromEmpty() {
    createPanelOpen = true;
    createMsg = '';
  }

  async function saveEdit() {
    if (!editingId || !editTitle.trim()) return;
    editSaving = true;
    try {
      await fetch('/api/brand/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          campaignId: editingId,
          action: 'update',
          title: editTitle.trim(),
          reward_inr: editReward,
        }),
      });
      editingId = null;
      await loadCampaigns();
    } catch {}
    editSaving = false;
  }

  function formatInr(n: number) {
    if (!n) return '₹0';
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
  }

  function formatDate(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function loadCampaigns() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/brand/requests', { credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      if (j.ok && j.campaigns) {
        campaigns = j.campaigns;
      } else {
        error = j.error || j.message || `Failed (HTTP ${res.status})`;
      }
    } catch {
      error = 'Network error';
    }
    loading = false;
  }

  async function submitNewBrief() {
    createMsg = '';
    if (!newTitle.trim() || !newCreativeText.trim()) {
      createMsg = 'Add a title and description.';
      return;
    }
    createBusy = true;
    try {
      const subsRes = await fetch('/api/brand/creator-subs', { credentials: 'include' })
        .then((r) => r.json())
        .catch(() => ({ ok: false }));
      const targets = subsRes.ok && Array.isArray(subsRes.targets) ? subsRes.targets : [];
      const res = await fetch('/api/brand/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          actorGoogleSub: null,
          brand_name: brandName,
          title: newTitle.trim(),
          creative_text: newCreativeText.trim(),
          reward_inr: Number(newRewardInr) || 50,
          structured_query: null,
          channels: { email: channelEmail, in_app: channelInApp, whatsapp: false },
          targets,
          creatives: [],
        }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        createMsg = (j.message as string) || (j.error as string) || 'Create failed';
      } else {
        const count = j.audience_count as number;
        createMsg =
          count > 0
            ? `Live · ${count} creators targeted`
            : 'Saved · Brief created (no creators targeted yet)';
        newTitle = '';
        newCreativeText = '';
        newRewardInr = 50;
        channelEmail = false;
        channelInApp = true;
        await loadCampaigns();
      }
    } catch {
      createMsg = 'Something went wrong. Try again.';
    }
    createBusy = false;
  }

  async function patchCampaign(campaignId: string, action: string, userSub?: string) {
    actionBusy = `${campaignId}:${action}:${userSub ?? ''}`;
    try {
      const body: Record<string, string> = { campaignId, action };
      if (userSub) body.userSub = userSub;
      await fetch('/api/brand/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      await loadCampaigns();
    } catch {}
    actionBusy = '';
  }

  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function headerKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded(id);
    }
  }

  onMount(loadCampaigns);
</script>

<svelte:head>
  <title>Briefs | Wagwan Brand OS</title>
</svelte:head>

<div class="bb-page">
  <header class="bb-header">
    <div class="bb-header-text">
      <h1 class="bb-title">Your Briefs</h1>
      <p class="bb-subtitle">
        Track outreach, acceptances, live posts, and proof — payouts and pipeline in one view.
      </p>
    </div>
    <div class="bb-header-actions">
      <button
        type="button"
        class="bb-btn-primary"
        class:bb-btn-primary--ghost={createPanelOpen}
        on:click={() => {
          createPanelOpen = !createPanelOpen;
          createMsg = '';
        }}
      >
        {createPanelOpen ? 'Close form' : 'New brief'}
      </button>
      <button type="button" class="bb-refresh" on:click={loadCampaigns} disabled={loading}>
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  </header>

  {#if createPanelOpen}
    <section class="bb-create-panel" aria-label="Create a new brief">
      <div class="bb-create-grid">
        <div class="bb-create-field">
          <label class="bb-create-label" for="bb-new-title">Title</label>
          <input
            id="bb-new-title"
            class="bb-create-input"
            placeholder="e.g. Summer launch, UGC roundup"
            bind:value={newTitle}
          />
        </div>
        <div class="bb-create-field bb-create-field--full">
          <label class="bb-create-label" for="bb-new-body">Brief</label>
          <textarea
            id="bb-new-body"
            class="bb-create-textarea"
            placeholder="What should creators post — tone, hooks, hashtags, deadlines…"
            rows={4}
            bind:value={newCreativeText}
          />
        </div>
        <div class="bb-create-field">
          <label class="bb-create-label" for="bb-new-reward">Reward per creator (₹)</label>
          <input
            id="bb-new-reward"
            class="bb-create-input bb-create-input--narrow"
            type="number"
            min="0"
            step="50"
            bind:value={newRewardInr}
          />
        </div>
        <div class="bb-create-field bb-create-channels">
          <span class="bb-create-label">Channels</span>
          <label class="bb-create-check"
            ><input type="checkbox" bind:checked={channelInApp} /> In-app</label
          >
          <label class="bb-create-check"
            ><input type="checkbox" bind:checked={channelEmail} /> Email</label
          >
        </div>
      </div>
      <div class="bb-create-footer">
        <button
          type="button"
          class="bb-create-submit"
          disabled={createBusy || !newTitle.trim() || !newCreativeText.trim()}
          on:click={submitNewBrief}
        >
          {createBusy ? 'Creating…' : 'Create brief'}
        </button>
        {#if createMsg}
          <span
            class="bb-create-msg"
            class:bb-create-msg--ok={createMsg.startsWith('Live') || createMsg.startsWith('Saved')}
          >
            {createMsg}
          </span>
        {/if}
      </div>
      <p class="bb-create-studio-link">
        <a href="/brands/portal?tab=content"
          >Match creators &amp; add reference creatives in Content Studio →</a
        >
      </p>
    </section>
  {/if}

  {#if loading && campaigns.length === 0}
    <div class="bb-empty">Loading campaigns...</div>
  {:else if error}
    <div class="bb-error">{error}</div>
  {:else if campaigns.length === 0}
    <div class="bb-empty bb-empty--splash">
      <p class="bb-empty-lead">No briefs yet — your campaign pipeline starts here.</p>
      <p class="bb-empty-copy">
        Spin up a quick brief below, or use Content Studio when you want AI matching and asset
        uploads.
      </p>
      <div class="bb-empty-actions">
        <button type="button" class="bb-btn-primary" on:click={openCreateFromEmpty}
          >Create a brief</button
        >
        <a class="bb-empty-secondary" href="/brands/portal?tab=content">Open Content Studio</a>
      </div>
    </div>
  {:else}
    <!-- Summary stats -->
    <div class="bb-stats">
      <div class="bb-stat">
        <span class="bb-metric-n">{campaigns.length}</span>
        <span class="bb-metric-l">Total briefs</span>
      </div>
      <div class="bb-stat">
        <span class="bb-metric-n">{campaigns.filter((c) => c.status === 'active').length}</span>
        <span class="bb-metric-l">Active</span>
      </div>
      <div class="bb-stat">
        <span class="bb-metric-n">
          {campaigns.reduce(
            (s, c) =>
              s +
              (c.counts.sent ?? 0) +
              (c.counts.accepted ?? 0) +
              (c.counts.live ?? 0) +
              (c.counts.completed ?? 0),
            0,
          )}
        </span>
        <span class="bb-metric-l">Creators reached</span>
      </div>
      <div class="bb-stat">
        <span class="bb-metric-n"
          >{campaigns.reduce((s, c) => s + (c.counts.completed ?? 0), 0)}</span
        >
        <span class="bb-metric-l">Completed</span>
      </div>
      <div class="bb-stat">
        <span class="bb-metric-n bb-metric-n--accent">
          {formatInr(campaigns.reduce((s, c) => s + (c.counts.completed ?? 0) * c.reward_inr, 0))}
        </span>
        <span class="bb-metric-l">Total spent</span>
      </div>
    </div>

    <!-- Campaign list -->
    <div class="bb-list">
      {#each campaigns as campaign (campaign.id)}
        <div class="bb-card" class:bb-card--expanded={expandedId === campaign.id}>
          <div
            class="bb-card-header"
            role="button"
            tabindex="0"
            aria-expanded={expandedId === campaign.id}
            on:click={() => toggleExpanded(campaign.id)}
            on:keydown={(e) => headerKeydown(e, campaign.id)}
          >
            <div class="bb-card-left">
              <div class="bb-card-initial">
                {(campaign.brand_name || campaign.title || '?').charAt(0)}
              </div>
              <div class="bb-card-info">
                <span class="bb-card-title">{campaign.title}</span>
                <span class="bb-card-date">{formatDate(campaign.created_at)}</span>
              </div>
            </div>
            <div class="bb-card-right">
              <span class="bb-card-reward bb-metric-n bb-metric-n--reward"
                >{formatInr(campaign.reward_inr)}</span
              >
              <span
                class="bb-card-status"
                class:bb-card-status--active={campaign.status === 'active'}
              >
                {campaign.status}
              </span>
              <button
                type="button"
                class="bb-edit-btn"
                on:click|stopPropagation={() => startEdit(campaign)}>Edit</button
              >
            </div>
          </div>

          <div class="bb-card-body">
            {#if campaign.creative_text?.trim()}
              <p class="bb-card-snippet">{campaign.creative_text}</p>
            {/if}
            <div class="bb-card-chips">
              <span class="bb-chip"
                >{campaign.members.length} creator{campaign.members.length === 1 ? '' : 's'}</span
              >
              {#if (campaign.counts.sent ?? 0) > 0}
                <span class="bb-chip">{campaign.counts.sent} in outreach</span>
              {/if}
              {#if (campaign.counts.declined ?? 0) > 0}
                <span class="bb-chip bb-chip--warn">{campaign.counts.declined} declined</span>
              {/if}
            </div>
            <p class="bb-card-hint">
              {expandedId === campaign.id
                ? 'Creator list open — click header to collapse'
                : 'Click or press Enter to view creator statuses'}
            </p>
          </div>

          {#if editingId === campaign.id}
            <div class="bb-edit-form">
              <div class="bb-edit-row">
                <label class="bb-edit-label" for="bb-edit-title-{campaign.id}">Title</label>
                <input
                  id="bb-edit-title-{campaign.id}"
                  class="bb-edit-input"
                  bind:value={editTitle}
                />
              </div>
              <div class="bb-edit-row">
                <label class="bb-edit-label" for="bb-edit-reward-{campaign.id}">Reward (₹)</label>
                <input
                  id="bb-edit-reward-{campaign.id}"
                  class="bb-edit-input bb-edit-input--small"
                  type="number"
                  bind:value={editReward}
                  min="0"
                  step="50"
                />
              </div>
              <div class="bb-edit-actions">
                <button
                  type="button"
                  class="bb-action-btn"
                  on:click={saveEdit}
                  disabled={editSaving}>{editSaving ? 'Saving...' : 'Save'}</button
                >
                <button type="button" class="bb-cancel-btn" on:click={cancelEdit}>Cancel</button>
              </div>
            </div>
          {/if}

          <!-- Funnel stats -->
          <div class="bb-funnel">
            <div class="bb-funnel-step">
              <span class="bb-metric-n bb-funnel-num">{campaign.counts.sent ?? 0}</span>
              <span class="bb-metric-l">Sent</span>
            </div>
            <span class="bb-funnel-arrow" aria-hidden="true">→</span>
            <div class="bb-funnel-step">
              <span class="bb-metric-n bb-funnel-num">{campaign.counts.accepted ?? 0}</span>
              <span class="bb-metric-l">Accepted</span>
            </div>
            <span class="bb-funnel-arrow" aria-hidden="true">→</span>
            <div class="bb-funnel-step">
              <span class="bb-metric-n bb-funnel-num">{campaign.counts.live ?? 0}</span>
              <span class="bb-metric-l">Live</span>
            </div>
            <span class="bb-funnel-arrow" aria-hidden="true">→</span>
            <div class="bb-funnel-step">
              <span class="bb-metric-n bb-funnel-num bb-metric-n--done"
                >{campaign.counts.completed ?? 0}</span
              >
              <span class="bb-metric-l">Completed</span>
            </div>
            {#if campaign.counts.declined}
              <div class="bb-funnel-step bb-funnel-step--decline">
                <span class="bb-metric-n bb-funnel-num bb-metric-n--pink"
                  >{campaign.counts.declined}</span
                >
                <span class="bb-metric-l">Declined</span>
              </div>
            {/if}
          </div>

          {#if campaign.creatives?.length}
            <div class="bb-creative-strip">
              {#each campaign.creatives.slice(0, 4) as creative}
                <div class="bb-creative-item">
                  {#if creative.media_type === 'video'}
                    <video src={creative.url} muted preload="metadata"></video>
                  {:else}
                    <img src={creative.thumb_url || creative.url} alt="Campaign creative" />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Expanded: per-creator detail -->
          {#if expandedId === campaign.id}
            <div class="bb-members">
              <div class="bb-members-head">
                <span>Creator</span>
                <span>Status</span>
                <span>Proof</span>
                <span>Actions</span>
              </div>
              {#each campaign.members as m}
                <div class="bb-member">
                  <span class="bb-member-sub" title={m.user_google_sub}
                    >{m.name || m.user_google_sub.slice(0, 16) + '...'}</span
                  >
                  <span class="bb-member-status bb-member-status--{m.status}">{m.status}</span>
                  <span class="bb-member-proof">
                    {#if m.ig_post_url}
                      <a href={m.ig_post_url} target="_blank" rel="noopener" class="bb-proof-link">
                        <ArrowSquareOut size={14} /> View post
                      </a>
                    {:else}
                      —
                    {/if}
                  </span>
                  <span class="bb-member-actions">
                    {#if m.status === 'accepted'}
                      <button
                        type="button"
                        class="bb-action-btn"
                        disabled={actionBusy === `${campaign.id}:mark_live:${m.user_google_sub}`}
                        on:click={() => patchCampaign(campaign.id, 'mark_live', m.user_google_sub)}
                        >Mark Live</button
                      >
                    {:else if m.status === 'completed'}
                      <CheckCircle size={16} weight="fill" color="#4ade80" />
                    {:else}
                      —
                    {/if}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .bb-page {
    padding: clamp(20px, 3vw, 40px);
    max-width: 1100px;
    margin: 0 auto;
    color: #ededef;
    font-family:
      'Geist Variable',
      'Inter',
      -apple-system,
      sans-serif;
  }

  .bb-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  }

  .bb-header-text {
    min-width: min(100%, 280px);
  }

  .bb-title {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: clamp(1.6rem, 3vw, 2.2rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    margin: 0 0 8px;
  }

  .bb-subtitle {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: rgba(255, 248, 232, 0.48);
    max-width: 36rem;
  }

  .bb-header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .bb-btn-primary {
    padding: 8px 18px;
    border: 1px solid rgba(196, 242, 74, 0.35);
    border-radius: 10px;
    background: rgba(196, 242, 74, 0.12);
    color: #c4f24a;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition:
      background 180ms ease,
      border-color 180ms ease,
      transform 180ms ease;
  }
  .bb-btn-primary:hover {
    background: rgba(196, 242, 74, 0.2);
    border-color: rgba(196, 242, 74, 0.5);
  }
  .bb-btn-primary:active {
    transform: scale(0.98);
  }
  .bb-btn-primary--ghost {
    background: transparent;
    color: rgba(255, 248, 232, 0.75);
    border-color: rgba(255, 255, 255, 0.15);
  }
  .bb-btn-primary--ghost:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #fff;
  }

  .bb-refresh {
    padding: 8px 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: transparent;
    color: rgba(255, 248, 232, 0.6);
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition:
      border-color 200ms ease,
      color 200ms ease;
  }
  .bb-refresh:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }
  .bb-refresh:disabled {
    opacity: 0.5;
  }

  /* ── Create panel ── */
  .bb-create-panel {
    margin-bottom: 28px;
    padding: 20px 22px 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
  }

  .bb-create-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 18px;
  }

  .bb-create-field--full {
    grid-column: 1 / -1;
  }

  .bb-create-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bb-create-channels {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
  }

  .bb-create-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 248, 232, 0.45);
  }

  .bb-create-input,
  .bb-create-textarea {
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    color: #ededef;
    font-size: 14px;
    font-family: inherit;
    outline: none;
  }
  .bb-create-input:focus,
  .bb-create-textarea:focus {
    border-color: rgba(196, 242, 74, 0.35);
  }

  .bb-create-input--narrow {
    max-width: 160px;
  }

  .bb-create-textarea {
    resize: vertical;
    min-height: 96px;
  }

  .bb-create-check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: rgba(255, 248, 232, 0.65);
    cursor: pointer;
  }

  .bb-create-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
  }

  .bb-create-submit {
    padding: 8px 20px;
    border: none;
    border-radius: 10px;
    background: #c4f24a;
    color: #121210;
    font-size: 13px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition:
      filter 180ms ease,
      transform 180ms ease;
  }
  .bb-create-submit:hover:not(:disabled) {
    filter: brightness(1.06);
  }
  .bb-create-submit:active:not(:disabled) {
    transform: scale(0.98);
  }
  .bb-create-submit:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .bb-create-msg {
    font-size: 13px;
    color: #ff4d97;
  }
  .bb-create-msg--ok {
    color: #9cec7b;
  }

  .bb-create-studio-link {
    margin: 14px 0 0;
    font-size: 12px;
  }
  .bb-create-studio-link a {
    color: rgba(196, 242, 74, 0.85);
    text-decoration: none;
  }
  .bb-create-studio-link a:hover {
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .bb-create-grid {
      grid-template-columns: 1fr;
    }
  }

  .bb-empty,
  .bb-error {
    text-align: center;
    padding: 48px 20px;
    color: rgba(255, 248, 232, 0.4);
    font-size: 14px;
  }
  .bb-error {
    color: #ff4d97;
  }

  .bb-empty--splash {
    padding: 40px 24px 56px;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.02);
  }

  .bb-empty-lead {
    margin: 0 0 10px;
    font-size: 17px;
    font-weight: 600;
    color: rgba(255, 248, 232, 0.88);
  }

  .bb-empty-copy {
    margin: 0 0 22px;
    line-height: 1.5;
    max-width: 28rem;
    margin-left: auto;
    margin-right: auto;
  }

  .bb-empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    align-items: center;
  }

  .bb-empty-secondary {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 248, 232, 0.55);
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 248, 232, 0.2);
    padding-bottom: 2px;
  }
  .bb-empty-secondary:hover {
    color: #c4f24a;
    border-color: rgba(196, 242, 74, 0.4);
  }

  /* ── Unified metrics (sans + tabular) ── */
  .bb-metric-n {
    font-family:
      'Geist Variable',
      'Inter',
      -apple-system,
      sans-serif;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    font-size: 1.35rem;
    letter-spacing: -0.02em;
    line-height: 1.2;
    color: rgba(255, 248, 232, 0.95);
  }

  .bb-metric-n--accent {
    color: #c4f24a;
  }

  .bb-metric-n--reward {
    font-size: 1.05rem;
    color: #c4f24a;
  }

  .bb-metric-n--done {
    color: #4ade80;
  }

  .bb-metric-n--pink {
    color: #ff4d97;
  }

  .bb-funnel-num {
    font-size: 15px;
  }

  .bb-metric-l {
    font-family:
      'Geist Variable',
      'Inter',
      -apple-system,
      sans-serif;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.03em;
    color: rgba(255, 248, 232, 0.42);
  }

  /* ── Stats row ── */
  .bb-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 32px;
    padding: 20px 24px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    flex-wrap: wrap;
  }

  .bb-stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* ── Campaign list ── */
  .bb-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bb-card {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    overflow: hidden;
    transition:
      border-color 200ms ease,
      box-shadow 200ms ease,
      transform 200ms ease;
  }
  .bb-card:hover {
    border-color: rgba(196, 242, 74, 0.15);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
    transform: translateY(-2px);
  }
  .bb-card--expanded {
    border-color: rgba(196, 242, 74, 0.22);
  }

  .bb-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: 16px 20px 10px;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .bb-card-body {
    padding: 0 20px 12px;
  }

  .bb-card-snippet {
    margin: 0 0 10px;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255, 248, 232, 0.55);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .bb-card-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .bb-chip {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 248, 232, 0.65);
  }

  .bb-chip--warn {
    background: rgba(255, 77, 151, 0.1);
    color: #ff8fb8;
  }

  .bb-card-hint {
    margin: 0;
    font-size: 11px;
    color: rgba(255, 248, 232, 0.32);
  }

  .bb-card-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .bb-card-initial {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(196, 242, 74, 0.1);
    color: #c4f24a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    font-size: 15px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .bb-card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .bb-card-title {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bb-card-date {
    font-size: 12px;
    color: rgba(255, 248, 232, 0.38);
  }

  .bb-card-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .bb-card-reward {
    /* uses .bb-metric-n */
  }

  .bb-card-status {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 248, 232, 0.5);
    font-family: inherit;
  }
  .bb-card-status--active {
    background: rgba(196, 242, 74, 0.1);
    color: #c4f24a;
  }

  /* ── Funnel ── */
  .bb-funnel {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 20px 14px;
    flex-wrap: wrap;
  }

  .bb-funnel-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .bb-funnel-arrow {
    color: rgba(255, 248, 232, 0.2);
    font-size: 14px;
  }

  .bb-funnel-step--decline .bb-metric-n {
    color: #ff4d97;
  }

  .bb-creative-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
    gap: 8px;
    padding: 0 20px 14px;
  }
  .bb-creative-item {
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    height: 76px;
  }
  .bb-creative-item img,
  .bb-creative-item video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* ── Members table ── */
  .bb-members {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding: 12px 20px 16px;
  }

  .bb-members-head {
    display: grid;
    grid-template-columns: 1fr 100px 120px 100px;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 248, 232, 0.38);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: inherit;
  }

  .bb-member {
    display: grid;
    grid-template-columns: 1fr 100px 120px 100px;
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    font-size: 12px;
  }

  .bb-member-sub {
    font-size: 12px;
    color: rgba(255, 248, 232, 0.55);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bb-member-status {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-family: inherit;
  }
  .bb-member-status--sent {
    color: rgba(255, 248, 232, 0.45);
  }
  .bb-member-status--accepted {
    color: #c4f24a;
  }
  .bb-member-status--live {
    color: #ff4d97;
  }
  .bb-member-status--completed {
    color: #4ade80;
  }
  .bb-member-status--declined {
    color: rgba(255, 248, 232, 0.3);
  }

  .bb-proof-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #c4f24a;
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
  }
  .bb-proof-link:hover {
    text-decoration: underline;
  }

  .bb-action-btn {
    padding: 4px 12px;
    border: 1px solid rgba(196, 242, 74, 0.2);
    border-radius: 8px;
    background: rgba(196, 242, 74, 0.08);
    color: #c4f24a;
    font-size: 10px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: background 200ms ease;
  }
  .bb-action-btn:hover {
    background: rgba(196, 242, 74, 0.15);
  }
  .bb-action-btn:disabled {
    opacity: 0.5;
  }

  .bb-edit-btn {
    padding: 4px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 248, 232, 0.5);
    font-size: 10px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition:
      border-color 200ms ease,
      color 200ms ease;
  }
  .bb-edit-btn:hover {
    border-color: rgba(196, 242, 74, 0.3);
    color: #c4f24a;
  }

  .bb-edit-form {
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bb-edit-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bb-edit-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #9cec7b;
    text-transform: uppercase;
    font-family: inherit;
  }

  .bb-edit-input {
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    color: #ededef;
    font-size: 13px;
    font-family: inherit;
    outline: none;
  }
  .bb-edit-input:focus {
    border-color: rgba(196, 242, 74, 0.4);
  }
  .bb-edit-input--small {
    max-width: 140px;
  }

  .bb-edit-actions {
    display: flex;
    gap: 8px;
  }

  .bb-cancel-btn {
    padding: 4px 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 248, 232, 0.5);
    font-size: 10px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .bb-cancel-btn:hover {
    color: #ff4d97;
    border-color: rgba(255, 77, 151, 0.2);
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .bb-stats {
      gap: 16px;
    }
    .bb-funnel {
      gap: 8px;
    }
    .bb-members-head,
    .bb-member {
      grid-template-columns: 1fr 80px;
    }
    .bb-members-head span:nth-child(3),
    .bb-members-head span:nth-child(4),
    .bb-member .bb-member-proof,
    .bb-member .bb-member-actions {
      display: none;
    }
  }
</style>
