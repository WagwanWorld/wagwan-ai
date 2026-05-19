<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import CreatorFeaturedCard from '$lib/components/brands/CreatorFeaturedCard.svelte';
  import { rosterEntryToView } from '$lib/utils/creatorCardView';
  import type { BrandCreatorRosterEntry } from '$lib/types/creator-invite';
  import type {
    CreatorInviteAnalysis,
    CreatorInviteLinks,
    RosterProfileSnapshot,
  } from '$lib/types/creator-invite';
  import {
    copyToClipboard,
    openInstagramDmFlow,
    patchRosterDelivery,
  } from '$lib/utils/rosterActions';

  export let brandAuthenticated = false;
  export let brandName = 'Brand';

  const dispatch = createEventDispatcher<{ rosterUpdated: void; goRoster: void }>();

  let handleInput = '';
  let busy = false;
  let error = '';
  let toast = '';

  let snapshot: RosterProfileSnapshot | null = null;
  let analysis: CreatorInviteAnalysis | null = null;
  let inviteMessage = '';
  let links: CreatorInviteLinks | null = null;
  let entryId: string | null = null;
  let rosterStatus: 'prospect' | 'on_platform' | null = null;

  $: inviteRow =
    snapshot && analysis && entryId
      ? ({
          id: entryId,
          brand_id: '',
          ig_username: snapshot.handle,
          display_name: snapshot.displayName,
          profile_snapshot: snapshot,
          user_google_sub: null,
          invite_message: inviteMessage,
          onboarding_url: links?.onboarding ?? '',
          analysis_snapshot: analysis,
          status: rosterStatus ?? (snapshot.onPlatform ? 'on_platform' : 'prospect'),
          delivery_status: 'draft' as const,
          sent_at: null,
          created_at: '',
          updated_at: '',
        } satisfies BrandCreatorRosterEntry)
      : null;

  function showToast(msg: string) {
    toast = msg;
    setTimeout(() => (toast = ''), 2800);
  }

  async function copyText(text: string, label: string) {
    const ok = await copyToClipboard(text);
    showToast(ok ? `${label} copied` : 'Copy failed');
    return ok;
  }

  async function patchDelivery(status: 'copied' | 'sent_manual') {
    if (!entryId) return;
    await patchRosterDelivery(entryId, status);
    dispatch('rosterUpdated');
  }

  async function generateInvite() {
    if (!brandAuthenticated || busy) return;
    const instagram = handleInput.trim();
    if (!instagram) {
      error = 'Enter an Instagram handle';
      return;
    }
    busy = true;
    error = '';
    snapshot = null;
    analysis = null;
    inviteMessage = '';
    links = null;
    entryId = null;
    rosterStatus = null;

    try {
      const res = await fetch('/api/brand/creator-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instagram }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'public_base_url_not_configured') {
          error = 'App URL is not configured. Set PUBLIC_BASE_URL in the environment.';
        } else if (res.status === 404) {
          error = "We couldn't load that profile. Check the handle and try again.";
        } else {
          error = data.message || data.error || 'Could not create invite';
        }
        return;
      }
      snapshot = data.profile as RosterProfileSnapshot;
      analysis = data.analysis;
      inviteMessage = data.inviteMessage ?? '';
      links = data.links;
      entryId = data.entry?.id ?? null;
      rosterStatus = data.entry?.status ?? (snapshot.onPlatform ? 'on_platform' : 'prospect');
      showToast(`Added @${snapshot.handle} to your roster`);
      dispatch('rosterUpdated');
    } catch {
      error = 'Something went wrong. Try again.';
    } finally {
      busy = false;
    }
  }

  async function sendOnInstagram() {
    if (!links || !inviteMessage) return;
    await copyText(inviteMessage, 'Message');
    await patchDelivery('copied');
    openInstagramDmFlow(links);
  }

  async function markSent() {
    await patchDelivery('sent_manual');
    showToast('Marked as sent');
  }
</script>

<section class="ci-invite" aria-labelledby="ci-invite-title">
  <div class="ci-invite-head">
    <h2 id="ci-invite-title" class="ci-invite-title">Invite a creator</h2>
    <p class="ci-invite-sub">
      Paste their Instagram handle — {brandName} will get a short analysis, invite message, and they'll
      be saved to your roster.
    </p>
    {#if brandAuthenticated}
      <button type="button" class="ci-invite-roster-link" on:click={() => dispatch('goRoster')}>
        View full roster →
      </button>
    {/if}
  </div>

  {#if !brandAuthenticated}
    <div class="ci-invite-gate">
      <p>Connect your brand Instagram to invite creators.</p>
      <a href="/brands/login" class="ci-invite-login">Connect Instagram</a>
    </div>
  {:else}
    <div class="ci-invite-form">
      <input
        class="ci-invite-input"
        type="text"
        placeholder="@username"
        bind:value={handleInput}
        disabled={busy}
        autocomplete="off"
        spellcheck="false"
        on:keydown={(e) => e.key === 'Enter' && generateInvite()}
      />
      <button class="ci-invite-btn" type="button" disabled={busy} on:click={generateInvite}>
        {busy ? 'Working…' : 'Generate invite'}
      </button>
    </div>

    {#if error}
      <p class="ci-invite-error" role="alert">{error}</p>
    {/if}

    {#if inviteRow}
      <div class="ci-invite-result">
        <CreatorFeaturedCard creator={rosterEntryToView(inviteRow)} barMetric="fit" />

        <label class="ci-invite-label" for="ci-invite-msg">Invite message</label>
        <textarea id="ci-invite-msg" class="ci-invite-textarea" rows="8" bind:value={inviteMessage}
        ></textarea>

        <p class="ci-invite-policy">
          Instagram doesn't allow apps to send cold DMs — tap Send on Instagram, paste in their
          profile DM.
        </p>

        <div class="ci-invite-actions">
          <button
            type="button"
            class="ci-invite-btn ci-invite-btn-primary"
            on:click={sendOnInstagram}
          >
            Send on Instagram
          </button>
          <button
            type="button"
            class="ci-invite-btn ci-invite-btn-ghost"
            on:click={() => links && copyText(links.onboarding, 'Join link')}
          >
            Copy join link
          </button>
          <button
            type="button"
            class="ci-invite-btn ci-invite-btn-ghost"
            on:click={() => copyText(inviteMessage, 'Message')}
          >
            Copy message
          </button>
          <button type="button" class="ci-invite-btn ci-invite-btn-ghost" on:click={markSent}>
            Mark as sent
          </button>
        </div>

        {#if links}
          <p class="ci-invite-link-row">
            <a
              href={links.onboarding}
              target="_blank"
              rel="noopener noreferrer"
              class="ci-invite-link"
            >
              {links.onboarding}
            </a>
            <span class="ci-invite-link-sep">·</span>
            <a
              href={links.instagramProfile}
              target="_blank"
              rel="noopener noreferrer"
              class="ci-invite-link"
            >
              @{snapshot.handle} on Instagram
            </a>
          </p>
        {/if}
      </div>
    {/if}
  {/if}

  {#if toast}
    <p class="ci-invite-toast" role="status">{toast}</p>
  {/if}
</section>

<style>
  .ci-invite {
    margin-bottom: 28px;
    padding: 20px 18px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .ci-invite-head {
    margin-bottom: 16px;
  }

  .ci-invite-title {
    font-family: 'PP Mori', 'Geist Variable', sans-serif;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #ededef;
    margin: 0 0 6px;
  }

  .ci-invite-sub {
    font-size: 13px;
    color: #4a4a50;
    line-height: 1.5;
    margin: 0;
    max-width: 520px;
  }

  .ci-invite-roster-link {
    margin-top: 10px;
    padding: 0;
    border: none;
    background: none;
    color: #8b8b94;
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .ci-invite-roster-link:hover {
    color: #ededef;
  }

  .ci-invite-gate {
    padding: 16px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    color: #6b6b72;
    font-size: 13px;
  }

  .ci-invite-login {
    display: inline-block;
    margin-top: 10px;
    color: #ededef;
    font-weight: 600;
    font-size: 13px;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .ci-invite-form {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .ci-invite-input {
    flex: 1;
    min-width: 180px;
    min-height: 44px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.25);
    color: #ededef;
    font-size: 14px;
  }

  .ci-invite-input::placeholder {
    color: #4a4a50;
  }

  .ci-invite-btn {
    min-height: 44px;
    padding: 0 18px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: #ededef;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .ci-invite-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ci-invite-btn-primary {
    background: #ededef;
    color: #0a0a0b;
    border-color: transparent;
  }

  .ci-invite-btn-ghost {
    background: transparent;
  }

  .ci-invite-error {
    margin: 12px 0 0;
    font-size: 13px;
    color: #e88;
  }

  .ci-invite-result {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .ci-invite-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
    display: block;
    margin-bottom: -8px;
  }

  .ci-invite-textarea {
    width: 100%;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
    color: #ededef;
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    font-family: inherit;
  }

  .ci-invite-policy {
    font-size: 11px;
    color: #4a4a50;
    margin: 0;
    line-height: 1.4;
  }

  .ci-invite-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ci-invite-link-row {
    margin: 0;
    font-size: 11px;
    word-break: break-all;
  }

  .ci-invite-link {
    color: #6b8cff;
    text-decoration: none;
  }

  .ci-invite-link:hover {
    text-decoration: underline;
  }

  .ci-invite-link-sep {
    color: #4a4a50;
    margin: 0 6px;
  }

  .ci-invite-toast {
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
