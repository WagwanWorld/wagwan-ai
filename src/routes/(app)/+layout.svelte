<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { profile, type UserProfile } from '$lib/stores/profile';
  import FloatingNav from '$lib/components/FloatingNav.svelte';
  import DesktopSidebar from '$lib/components/DesktopSidebar.svelte';
  import { applyPaletteFromProfile } from '$lib/theme/identityColors';
  import { startTimeShiftLoop } from '$lib/theme/timeShift';
  import {
    isAppSessionValid,
    maybeRepairIgOnlyAccountKey,
    invalidateAndGoToOnboarding,
  } from '$lib/auth/sessionGate';
  import { maybeStaleGraphRefresh } from '$lib/client/maybeStaleGraphRefresh';

  let stopTimeShift: (() => void) | null = null;

  onMount(() => {
    try {
      const fromStore = get(profile);
      const raw = localStorage.getItem('wagwan_profile_v2');
      let parsed = raw ? (JSON.parse(raw) as UserProfile) : null;

      // Just finished onboarding: store may be valid even if localStorage write failed (quota, etc.)
      if (fromStore.setupComplete && isAppSessionValid(fromStore)) {
        if (!parsed?.setupComplete) {
          profile.set(fromStore);
          parsed = fromStore;
        }
      }

      const session = parsed;
      if (!session?.setupComplete) {
        goto('/', { replaceState: true });
        return;
      }

      if (session !== fromStore && !fromStore.setupComplete) {
        profile.set(session);
      }

      const repaired = maybeRepairIgOnlyAccountKey(get(profile));
      if (repaired) {
        profile.set(repaired);
        void fetch('/api/profile/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleSub: repaired.googleSub,
            profile: repaired,
            tokens: {},
          }),
        }).catch(() => {});
      }
      if (!isAppSessionValid(get(profile))) {
        invalidateAndGoToOnboarding();
        return;
      }
    } catch {
      goto('/', { replaceState: true });
      return;
    }

    const palette = applyPaletteFromProfile($profile);
    stopTimeShift = startTimeShiftLoop(palette);

    // Background sync from Supabase (non-blocking)
    const sub = get(profile).googleSub;
    if (sub) {
      fetch(`/api/profile/load?sub=${encodeURIComponent(sub)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.ok || !data.profile) return;
          const remote = data.profile as Record<string, unknown>;
          const remoteTs = data.updatedAt as string;
          const localTs = $profile.profileUpdatedAt || '';
          if (remoteTs && remoteTs > localTs) {
            profile.update(p => ({
              ...p,
              ...(remote as Partial<typeof p>),
              profileUpdatedAt: remoteTs,
            }));
          }
          if (data.graphStale === true) {
            maybeStaleGraphRefresh(sub, true);
          }
        })
        .catch(() => {});
    }
  });

  onDestroy(() => {
    stopTimeShift?.();
  });

  $: path = $page.url.pathname;
  $: pageWrapFill = path === '/home' || path === '/ai' || path.startsWith('/chat/');
  $: appContentScrolls = path !== '/home' && path !== '/ai' && !path.startsWith('/chat/');
</script>

<div class="app-shell ambient-bg app-shell--rail" data-app-chrome="dark">
  <DesktopSidebar />
  <div
    class="app-content min-w-0 flex-1 lg:min-h-0"
    class:app-scroll-region={appContentScrolls}
    class:overflow-y-auto={appContentScrolls}
    class:overflow-y-hidden={!appContentScrolls}
  >
    <div
      class="page-wrap"
      class:page-wrap--fill={pageWrapFill}
      class:page-wrap--in-app-scroll={appContentScrolls}
      class:overflow-hidden={path === '/home'}
    >
      <slot />
    </div>
  </div>
  <FloatingNav />
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    height: 100%;
    min-height: 100%;
  }

  @media (min-width: 768px) {
    .app-shell--rail {
      flex-direction: row;
      align-items: stretch;
    }
  }

  @media (min-width: 1024px) {
    .app-shell--rail {
      gap: var(--home-layout-gutter);
    }
  }

  .app-content {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    scrollbar-width: none;
  }

  /* Mobile: account for fixed top bar + bottom tabs */
  @media (max-width: 767px) {
    .app-content {
      padding-top: 52px;
      padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
    }
  }

  .page-wrap {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 0 0 auto;
    width: 100%;
  }

  .page-wrap--fill {
    flex: 1;
    min-height: 0;
  }

  /** Routes that scroll inside app-content: let content determine height so it can overflow the scroll container. */
  .page-wrap--in-app-scroll {
    flex: 0 0 auto;
    width: 100%;
  }
</style>
