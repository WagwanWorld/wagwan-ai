<script lang="ts">
  import { page } from '$app/stores';

  $: onPortal = $page.url.pathname.startsWith('/brands/portal');
  $: onLogin = $page.url.pathname.startsWith('/brands/login');
</script>

<div
  class="brands-studio flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0B0B0D] text-zinc-100 antialiased selection:bg-violet-500/30 selection:text-white"
>
  <header
    class="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0B0B0D]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0B0B0D]/60"
  >
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3.5">
      <a
        href="/brands"
        class="group flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-zinc-400 no-underline transition-colors duration-300 hover:text-white"
      >
        <span
          class="h-2 w-2 rounded-full bg-violet-500/80 shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-[box-shadow] duration-300 group-hover:shadow-[0_0_18px_rgba(167,139,250,0.85)]"
          aria-hidden="true"
        ></span>
        WAGWAN STUDIO
      </a>
      <nav class="hidden items-center gap-8 text-xs font-medium tracking-wide text-zinc-500 sm:flex">
        <a
          href="/brands/portal"
          class="no-underline transition-colors duration-200 hover:text-white {onPortal
            ? 'text-white'
            : ''}"
        >
          Audience
        </a>
        <a
          href="/brands/portal"
          class="no-underline transition-colors duration-200 hover:text-white"
        >
          Campaigns
        </a>
        <a href="/brands" class="no-underline transition-colors duration-200 hover:text-white">Overview</a>
      </nav>
      <div class="flex items-center gap-3">
        <a
          href="/"
          class="text-xs text-zinc-500 no-underline transition-colors hover:text-zinc-300"
        >
          For creators
        </a>
        {#if !onLogin}
          <a
            href="/brands/login?next=/brands/portal"
            class="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-200 no-underline transition-all duration-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white hover:shadow-[0_0_24px_rgba(139,92,246,0.15)]"
          >
            Sign in
          </a>
        {/if}
      </div>
    </div>
  </header>
  <main class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
    <slot />
  </main>
</div>
