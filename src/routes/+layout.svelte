<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import '../app.css';
  import AmbientGradients from '$lib/components/AmbientGradients.svelte';
  import OsPageShell from '$lib/components/os/OsPageShell.svelte';
  import { applyThemeToDocument } from '$lib/stores/theme';

  function syncAppSurface(path: string) {
    if (!browser) return;
    let surface = '';
    if (path.startsWith('/home')) surface = 'home';
    else if (path.startsWith('/explore')) surface = 'explore';
    else if (path.startsWith('/ai')) surface = 'ai';
    else if (path.startsWith('/profile')) surface = 'profile';
    else if (path.startsWith('/chats') || path.startsWith('/chat')) surface = 'chats';
    else if (path.startsWith('/earn')) surface = 'earn';
    else if (path.startsWith('/brands')) surface = 'brands';
    else if (path.startsWith('/onboarding')) surface = 'onboarding';
    if (surface) document.documentElement.setAttribute('data-app-surface', surface);
    else document.documentElement.removeAttribute('data-app-surface');
  }

  $: syncAppSurface($page.url.pathname);
  $: path = $page.url.pathname;
  $: useMarketingShell =
    path === '/' ||
    path.startsWith('/onboarding') ||
    path.startsWith('/privacy') ||
    path.startsWith('/terms') ||
    path.startsWith('/data-deletion') ||
    path.startsWith('/auth/applemusic/connect');

  onMount(() => {
    applyThemeToDocument();
  });
</script>

<div
  class="root-shell relative flex w-full h-svh flex-col overflow-hidden"
  style="background:var(--bg); color:var(--text);"
>
  <AmbientGradients />
  <div class="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
    {#if useMarketingShell}
      <OsPageShell as="div">
        <slot />
      </OsPageShell>
    {:else}
      <slot />
    {/if}
  </div>
</div>
