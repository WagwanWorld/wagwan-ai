<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import CreatorRosterListItem from '$lib/components/brands/CreatorRosterListItem.svelte';
  import CreatorFeaturedCard from '$lib/components/brands/CreatorFeaturedCard.svelte';
  import { rosterEntryToView } from '$lib/utils/creatorCardView';
  import type { BrandCreatorRosterEntry, CreatorInviteLinks } from '$lib/types/creator-invite';
  import {
    buildInstagramLinks,
    copyToClipboard,
    deleteRosterEntry,
    openInstagramDmFlow,
    patchRosterDelivery,
  } from '$lib/utils/rosterActions';

  export let brandAuthenticated = false;

  const dispatch = createEventDispatcher<{
    rosterUpdated: { count: number };
    goInvite: void;
  }>();

  type FilterKey = 'all' | 'draft' | 'copied' | 'sent' | 'on_platform';

  let roster: BrandCreatorRosterEntry[] = [];
  let loading = true;
  let error = '';
  let toast = '';
  let searchQuery = '';
  let activeFilter: FilterKey = 'all';
  let selectedId: string | null = null;

  $: selected = roster.find((r) => r.id === selectedId) ?? null;
  $: selectedLinks = selected
    ? ({
        onboarding: selected.onboarding_url,
        ...buildInstagramLinks(selected.ig_username),
      } satisfies CreatorInviteLinks)
    : null;

  $: filtered = roster.filter((row) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      row.ig_username.toLowerCase().includes(q) ||
      row.display_name.toLowerCase().includes(q) ||
      row.profile_snapshot.displayName.toLowerCase().includes(q)
    );
  });

  async function loadRoster() {
    if (!brandAuthenticated) {
      loading = false;
      roster = [];
      return;
    }
    loading = true;
    error = '';
    try {
      const params = new URLSearchParams();
      if (activeFilter === 'draft') params.set('delivery_status', 'draft');
      else if (activeFilter === 'copied') params.set('delivery_status', 'copied');
      else if (activeFilter === 'sent') params.set('delivery_status', 'sent_manual');
      else if (activeFilter === 'on_platform') params.set('status', 'on_platform');
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const qs = params.toString();
      const res = await fetch(`/api/brand/creator-roster${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load roster');
      roster = data.roster ?? [];
      dispatch('rosterUpdated', { count: roster.length });

      if (roster.length > 0) {
        if (!selectedId || !roster.some((r) => r.id === selectedId)) {
          selectedId = roster[0].id;
        }
      } else {
        selectedId = null;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load roster';
    } finally {
      loading = false;
    }
  }

  onMount(loadRoster);

  function showToast(msg: string) {
    toast = msg;
    setTimeout(() => (toast = ''), 2800);
  }

  async function copyText(text: string, label: string) {
    const ok = await copyToClipboard(text);
    showToast(ok ? `${label} copied` : 'Copy failed');
    return ok;
  }

  async function sendOnInstagram() {
    if (!selected || !selectedLinks) return;
    await copyText(selected.invite_message, 'Message');
    await patchRosterDelivery(selected.id, 'copied');
    openInstagramDmFlow(selectedLinks);
    await loadRoster();
  }

  async function markSent() {
    if (!selected) return;
    await patchRosterDelivery(selected.id, 'sent_manual');
    showToast('Marked as sent');
    await loadRoster();
  }

  async function removeSelected() {
    if (!selected || !confirm(`Remove @${selected.ig_username} from your roster?`)) return;
    const ok = await deleteRosterEntry(selected.id);
    if (ok) {
      showToast('Removed from roster');
      await loadRoster();
    } else {
      showToast('Could not remove');
    }
  }

  function selectRow(id: string) {
    selectedId = id;
  }

  function goInvite() {
    dispatch('goInvite');
  }
</script>

<section class="crd" aria-labelledby="crd-title">
  <header class="crd-head">
    <div>
      <h2 id="crd-title" class="crd-title">My roster</h2>
      <p class="crd-sub">Saved creators with full profile snapshots and invite copy.</p>
    </div>
    <span class="crd-count">{loading ? '—' : roster.length}</span>
  </header>

  {#if !brandAuthenticated}
    <div class="crd-gate">
      <p>Connect your brand Instagram to build a creator roster.</p>
      <a href="/brands/login" class="crd-link">Connect Instagram</a>
    </div>
  {:else}
    <div class="crd-toolbar">
      <input
        class="crd-search"
        type="search"
        placeholder="Search by name or @handle"
        bind:value={searchQuery}
        on:input={() => {
          /* client filter via $: filtered */
        }}
      />
      <div class="crd-filters" role="tablist" aria-label="Roster filters">
        {#each [{ key: 'all', label: 'All' }, { key: 'draft', label: 'Draft' }, { key: 'copied', label: 'Copied' }, { key: 'sent', label: 'Sent' }, { key: 'on_platform', label: 'On Wagwan' }] as f}
          <button
            type="button"
            class="crd-filter"
            class:crd-filter--active={activeFilter === f.key}
            on:click={() => {
              activeFilter = f.key as FilterKey;
              loadRoster();
            }}
          >
            {f.label}
          </button>
        {/each}
      </div>
    </div>

    {#if error}
      <p class="crd-error" role="alert">{error}</p>
    {/if}

    {#if loading}
      <div class="crd-skeleton">
        {#each [1, 2, 3] as _}
          <div class="crd-skel-row"></div>
        {/each}
      </div>
    {:else if roster.length === 0}
      <div class="crd-empty">
        <p>No creators in your roster yet.</p>
        <button type="button" class="crd-btn crd-btn-primary" on:click={goInvite}
          >Invite a creator</button
        >
      </div>
    {:else}
      <div class="crd-body">
        <div class="crd-list" role="list">
          {#each filtered as row (row.id)}
            <CreatorRosterListItem
              {row}
              selected={selectedId === row.id}
              on:click={() => selectRow(row.id)}
            />
          {/each}
        </div>

        {#if selected}
          <div class="crd-detail">
            <CreatorFeaturedCard creator={rosterEntryToView(selected)} barMetric="fit" />

            <div class="crd-invite-card">
              <div class="crd-invite-head">
                <span class="crd-kicker">Invite message</span>
                <span class="crd-delivery">
                  {selected.delivery_status === 'sent_manual'
                    ? 'Sent'
                    : selected.delivery_status === 'copied'
                      ? 'Copied'
                      : 'Draft'}
                </span>
              </div>
              <textarea class="crd-textarea" rows="6" readonly value={selected.invite_message}
              ></textarea>
              <p class="crd-policy">
                Instagram doesn't allow cold DMs from apps — copy the message and open their
                profile.
              </p>
              <div class="crd-actions">
                <button type="button" class="crd-btn crd-btn-primary" on:click={sendOnInstagram}>
                  Send on Instagram
                </button>
                <button
                  type="button"
                  class="crd-btn"
                  on:click={() => selectedLinks && copyText(selectedLinks.onboarding, 'Join link')}
                >
                  Copy join link
                </button>
                <button
                  type="button"
                  class="crd-btn"
                  on:click={() => copyText(selected.invite_message, 'Message')}
                >
                  Copy message
                </button>
                <button type="button" class="crd-btn" on:click={markSent}>Mark as sent</button>
                <button type="button" class="crd-btn crd-btn-ghost" on:click={removeSelected}
                  >Remove</button
                >
              </div>
              {#if selectedLinks}
                <a
                  href={selectedLinks.onboarding}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="crd-ext-link"
                >
                  {selectedLinks.onboarding}
                </a>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  {#if toast}
    <p class="crd-toast" role="status">{toast}</p>
  {/if}
</section>

<style>
  .crd {
    margin-bottom: 28px;
  }

  .crd-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .crd-title {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #ededef;
    margin: 0 0 4px;
  }

  .crd-sub {
    margin: 0;
    font-size: 13px;
    color: #4a4a50;
    line-height: 1.45;
  }

  .crd-count {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 32px;
    font-weight: 300;
    color: #ededef;
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .crd-gate,
  .crd-empty {
    padding: 28px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    color: #6b6b72;
    font-size: 13px;
    text-align: center;
  }

  .crd-link {
    display: inline-block;
    margin-top: 12px;
    color: #ededef;
    font-weight: 600;
  }

  .crd-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 16px;
    align-items: center;
  }

  .crd-search {
    flex: 1;
    min-width: 200px;
    min-height: 40px;
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
    color: #ededef;
    font-size: 13px;
  }

  .crd-search::placeholder {
    color: #4a4a50;
  }

  .crd-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .crd-filter {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: transparent;
    color: #6b6b72;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .crd-filter:hover {
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .crd-filter--active {
    background: rgba(255, 255, 255, 0.08);
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.14);
  }

  .crd-error {
    color: #e88;
    font-size: 13px;
    margin-bottom: 12px;
  }

  .crd-skeleton {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .crd-skel-row {
    height: 68px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    animation: crd-pulse 1.2s ease-in-out infinite;
  }

  @keyframes crd-pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  .crd-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .crd-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .crd-detail {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .crd-invite-card {
    padding: 16px 18px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(0, 0, 0, 0.15);
  }

  .crd-invite-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .crd-kicker {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .crd-delivery {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #8b8b94;
  }

  .crd-textarea {
    width: 100%;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    color: #b8b8be;
    font-size: 13px;
    line-height: 1.55;
    font-family: inherit;
    resize: vertical;
  }

  .crd-policy {
    font-size: 11px;
    color: #4a4a50;
    margin: 10px 0 12px;
    line-height: 1.4;
  }

  .crd-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .crd-btn {
    min-height: 38px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: #ededef;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .crd-btn-primary {
    background: #ededef;
    color: #0a0a0b;
    border-color: transparent;
  }

  .crd-btn-ghost {
    background: transparent;
    color: #8b8b94;
    border-color: rgba(232, 136, 136, 0.2);
  }

  .crd-ext-link {
    display: block;
    margin-top: 12px;
    font-size: 11px;
    color: #6b8cff;
    word-break: break-all;
    text-decoration: none;
  }

  .crd-ext-link:hover {
    text-decoration: underline;
  }

  .crd-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 16px;
    border-radius: 8px;
    background: #2a2a30;
    color: #ededef;
    font-size: 13px;
    z-index: 100;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
</style>
