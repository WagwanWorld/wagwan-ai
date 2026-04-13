<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowRight } from '@lucide/svelte';

  let portalSecret = '';
  let err = '';
  let loading = false;

  function safeNextPath(raw: string | null): string {
    if (raw == null || typeof raw !== 'string') return '/brands/portal';
    const t = raw.trim();
    if (!t.startsWith('/') || t.startsWith('//')) return '/brands/portal';
    return t;
  }

  async function submit() {
    err = '';
    loading = true;
    try {
      const res = await fetch('/api/brands/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalSecret }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        err = (j as { message?: string }).message || (j as { error?: string }).error || 'Sign in failed';
        return;
      }
      const next = safeNextPath($page.url.searchParams.get('next'));
      await goto(next, { replaceState: true });
    } finally {
      loading = false;
    }
  }
</script>

<div
  class="relative flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4 py-16"
>
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(139,92,246,0.12),transparent)]"
    aria-hidden="true"
  ></div>

  <div
    class="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111113]/90 p-8 shadow-[0_0_80px_rgba(0,0,0,0.5)] backdrop-blur-xl"
  >
    <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Operator</p>
    <h1 class="mt-3 text-2xl font-semibold text-white">Brand sign in</h1>
    <p class="mt-2 text-sm leading-relaxed text-zinc-500">
      Portal secret unlocks campaign launch and channels. Exploring audiences on
      <a href="/brands/portal" class="text-violet-300/90 underline-offset-2 hover:underline">/brands/portal</a>
      stays open.
    </p>

    <form class="mt-8 space-y-4" on:submit|preventDefault={() => submit()}>
      <div>
        <label for="portal-secret" class="block text-xs font-medium uppercase tracking-wider text-zinc-500"
          >Portal secret</label
        >
        <input
          id="portal-secret"
          type="password"
          autocomplete="current-password"
          class="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#0B0B0D] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-violet-500/45"
          bind:value={portalSecret}
          required
        />
      </div>
      {#if err}
        <p class="text-sm text-red-400/90">{err}</p>
      {/if}
      <button
        type="submit"
        disabled={loading}
        class="group flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-[#0B0B0D] transition-all hover:shadow-[0_0_32px_rgba(167,139,250,0.2)] disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Continue'}
        {#if !loading}<ArrowRight size={16} class="transition-transform group-hover:translate-x-0.5" />{/if}
      </button>
    </form>

    <p class="mt-8 text-center text-xs text-zinc-600">
      <a href="/brands" class="text-zinc-400 no-underline hover:text-white">← Studio home</a>
      <span class="mx-2 text-zinc-700">·</span>
      <a href="/" class="text-zinc-400 no-underline hover:text-white">User app</a>
    </p>
  </div>
</div>
