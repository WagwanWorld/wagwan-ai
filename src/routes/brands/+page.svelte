<script lang="ts">
  import { ArrowRight, Sparkles } from '@lucide/svelte';

  const trustMarks = ['Culture-led', 'Signal-rich', 'Consent-first', 'Identity-native', 'Feed-native'];

  function smoothScrollStudio(el: HTMLElement | null) {
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let trustSection: HTMLElement | null = null;
</script>

<div class="relative">
  <!-- Hero -->
  <section
    class="relative flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4 pb-24 pt-12 md:pt-8"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(139,92,246,0.18),transparent),radial-gradient(ellipse_60%_50%_at_100%_50%,rgba(236,72,153,0.08),transparent),radial-gradient(ellipse_50%_40%_at_0%_80%,rgba(59,130,246,0.06),transparent)]"
      aria-hidden="true"
    ></div>
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-soft-light"
      style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 512 512%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')"
      aria-hidden="true"
    ></div>

    <p
      class="relative z-[1] mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500"
    >
      Brand intelligence
    </p>
    <h1
      class="relative z-[1] max-w-4xl text-center text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl md:leading-[1.02]"
    >
      Direct your audience.
      <span class="block bg-gradient-to-r from-zinc-200 via-white to-zinc-400 bg-clip-text text-transparent">
        Not just target them.
      </span>
    </h1>
    <p class="relative z-[1] mt-6 max-w-xl text-center text-base leading-relaxed text-zinc-500 md:text-lg">
      One prompt becomes real people, real signals, real campaigns—built for culture, not spreadsheets.
    </p>
    <div class="relative z-[1] mt-12 flex flex-wrap items-center justify-center gap-4">
      <a
        href="/brands/portal"
        class="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#0B0B0D] no-underline shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_48px_rgba(167,139,250,0.25)]"
      >
        Enter studio
        <ArrowRight
          size={18}
          class="transition-transform duration-300 group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </a>
      <button
        type="button"
        class="rounded-full border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-zinc-300 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        on:click={() => smoothScrollStudio(trustSection)}
      >
        Why Wagwan
      </button>
    </div>
  </section>

  <!-- Trust strip -->
  <section
    bind:this={trustSection}
    class="border-t border-white/[0.06] bg-[#111113] px-4 py-16"
  >
    <div class="mx-auto max-w-5xl">
      <p class="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-600">
        Built for brands who live in culture
      </p>
      <div
        class="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-8 opacity-40 grayscale transition-opacity duration-500 hover:opacity-70 hover:grayscale-0"
      >
        {#each trustMarks as mark}
          <span class="text-sm font-medium tracking-[0.2em] text-zinc-400">{mark}</span>
        {/each}
      </div>
      <div class="mx-auto mt-16 grid max-w-3xl gap-6 md:grid-cols-3">
        <div
          class="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_0_32px_rgba(139,92,246,0.08)]"
        >
          <Sparkles class="text-violet-400/80" size={20} strokeWidth={1.5} />
          <h2 class="mt-4 text-sm font-semibold text-white">Prompt-first</h2>
          <p class="mt-2 text-sm leading-relaxed text-zinc-500">
            Describe who you want in plain language. We map it to identity signals—not checkbox demographics.
          </p>
        </div>
        <div
          class="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_0_32px_rgba(139,92,246,0.08)]"
        >
          <Sparkles class="text-fuchsia-400/70" size={20} strokeWidth={1.5} />
          <h2 class="mt-4 text-sm font-semibold text-white">See the audience</h2>
          <p class="mt-2 text-sm leading-relaxed text-zinc-500">
            Visual, living results—so you feel the match, not just a row of anonymous IDs.
          </p>
        </div>
        <div
          class="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_0_32px_rgba(139,92,246,0.08)]"
        >
          <Sparkles class="text-amber-400/70" size={20} strokeWidth={1.5} />
          <h2 class="mt-4 text-sm font-semibold text-white">Launch with intent</h2>
          <p class="mt-2 text-sm leading-relaxed text-zinc-500">
            When you are ready, sign in and push channels— in-app, email, more to come.
          </p>
        </div>
      </div>
    </div>
  </section>
</div>
