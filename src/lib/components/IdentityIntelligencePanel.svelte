<script lang="ts">
  import type { IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';

  export let intelligence: IdentityIntelligenceWrapper | null = null;

  /** `home`: dark glass for Home; `default`: light card elsewhere. */
  export let variant: 'default' | 'home' = 'default';

  function pct(n: number): string {
    return `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`;
  }

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return iso;
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  function modeLabel(mode: string): string {
    return mode.replace(/_/g, ' ');
  }
</script>

{#if intelligence?.payload}
  {@const p = intelligence.payload}
  {#if variant === 'home'}
    <div class="ihp-home">
      <div class="ihp-home__head">
        <p class="ihp-home__kicker">Operator view</p>
        <div class="ihp-home__badges">
          <span class="ihp-home__pill">{modeLabel(p.snapshot.mode)}</span>
          <span class="ihp-home__conf">{pct(p.snapshot.confidence)} confident</span>
        </div>
      </div>

      <p class="ihp-home__line">{p.snapshot.one_line_state}</p>

      <div class="ihp-home__grid3">
        <div class="ihp-home__cell">
          <p class="ihp-home__cell-k">Focus</p>
          <p class="ihp-home__cell-v">{p.now.focus}</p>
        </div>
        <div class="ihp-home__cell">
          <p class="ihp-home__cell-k">Pressure</p>
          <p class="ihp-home__cell-v">{p.now.pressure}</p>
        </div>
        <div class="ihp-home__cell">
          <p class="ihp-home__cell-k">Momentum</p>
          <p class="ihp-home__cell-v">{p.now.momentum}</p>
        </div>
      </div>

      <div class="ihp-home__decision">
        <p class="ihp-home__kicker ihp-home__kicker--tight">Do this now</p>
        <p class="ihp-home__do-now">{p.decision.do_this_now}</p>
        <p class="ihp-home__why">{p.decision.why_this_matters}</p>
        {#if p.decision.then_do.length}
          <p class="ihp-home__cell-k ihp-home__then-label">Then</p>
          <ul class="ihp-home__bullets">
            {#each p.decision.then_do as line}
              <li>
                <span class="ihp-home__bullet" aria-hidden="true"></span>
                {line}
              </li>
            {/each}
          </ul>
        {/if}
        {#if p.decision.stop_doing.length}
          <p class="ihp-home__stop-k">Stop doing</p>
          <ul class="ihp-home__bullets ihp-home__bullets--stop">
            {#each p.decision.stop_doing as line}
              <li>
                <span class="ihp-home__bullet ihp-home__bullet--stop" aria-hidden="true"></span>
                {line}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <details class="ihp-home__details">
        <summary class="ihp-home__summary">Blindspots, leverage, trajectory</summary>
        <div class="ihp-home__more">
          {#if p.blindspots.length}
            <div>
              <p class="ihp-home__cell-k">Blindspots</p>
              <ul class="ihp-home__blind-list">
                {#each p.blindspots as b}
                  <li class="ihp-home__blind-item">
                    <p class="ihp-home__blind-issue">{b.issue}</p>
                    <p class="ihp-home__blind-impact">{b.impact}</p>
                    <p class="ihp-home__blind-fix">Fix: {b.fix}</p>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          <div class="ihp-home__lev-grid">
            {#if p.leverage.unfair_advantages.length}
              <div>
                <p class="ihp-home__cell-k">Unfair advantages</p>
                <ul class="ihp-home__list">
                  {#each p.leverage.unfair_advantages as x}
                    <li>{x}</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if p.leverage.underused_assets.length}
              <div>
                <p class="ihp-home__cell-k">Underused assets</p>
                <ul class="ihp-home__list">
                  {#each p.leverage.underused_assets as x}
                    <li>{x}</li>
                  {/each}
                </ul>
              </div>
            {/if}
            {#if p.leverage.quick_wins.length}
              <div>
                <p class="ihp-home__cell-k">Quick wins</p>
                <ul class="ihp-home__list">
                  {#each p.leverage.quick_wins as x}
                    <li>{x}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
          <div class="ihp-home__traj-box">
            <p class="ihp-home__cell-k">Trajectory</p>
            <p class="ihp-home__traj-line"><span class="ihp-home__traj-key">Direction:</span> {p.trajectory.direction}</p>
            <p class="ihp-home__traj-line"><span class="ihp-home__traj-key">Risk:</span> {p.trajectory.risk}</p>
            <p class="ihp-home__traj-line">
              <span class="ihp-home__traj-key">Next critical move:</span>
              {p.trajectory.next_critical_move}
            </p>
          </div>
        </div>
      </details>

      <p class="ihp-home__footer">
        Updated {fmtDate(intelligence.generatedAt)}{#if intelligence.userQuery}
          · Q: {intelligence.userQuery}{/if}
      </p>
    </div>
  {:else}
  <div class="rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/40 to-white p-4 shadow-sm sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <p class="text-[10px] font-bold uppercase tracking-widest text-amber-900/90">Operator view</p>
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-amber-950 ring-1 ring-amber-300/60"
        >
          {modeLabel(p.snapshot.mode)}
        </span>
        <span class="text-[11px] font-medium text-zinc-500"
          >{pct(p.snapshot.confidence)} confident</span
        >
      </div>
    </div>

    <p class="mt-3 text-base font-semibold leading-snug text-zinc-900">{p.snapshot.one_line_state}</p>

    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-zinc-100 bg-white/80 p-3">
        <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Focus</p>
        <p class="mt-1 text-sm text-zinc-800">{p.now.focus}</p>
      </div>
      <div class="rounded-xl border border-zinc-100 bg-white/80 p-3">
        <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Pressure</p>
        <p class="mt-1 text-sm text-zinc-800">{p.now.pressure}</p>
      </div>
      <div class="rounded-xl border border-zinc-100 bg-white/80 p-3">
        <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Momentum</p>
        <p class="mt-1 text-sm text-zinc-800">{p.now.momentum}</p>
      </div>
    </div>

    <div class="mt-5 rounded-xl border border-zinc-900/10 bg-zinc-900/[0.03] p-4">
      <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Do this now</p>
      <p class="mt-2 text-sm font-semibold leading-relaxed text-zinc-900">{p.decision.do_this_now}</p>
      <p class="mt-3 text-xs leading-relaxed text-zinc-600">{p.decision.why_this_matters}</p>
      {#if p.decision.then_do.length}
        <p class="mt-4 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Then</p>
        <ul class="mt-2 space-y-1.5">
          {#each p.decision.then_do as line}
            <li class="flex gap-2 text-xs text-zinc-800">
              <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>
              <span>{line}</span>
            </li>
          {/each}
        </ul>
      {/if}
      {#if p.decision.stop_doing.length}
        <p class="mt-4 text-[10px] font-bold uppercase tracking-wide text-red-800/80">Stop doing</p>
        <ul class="mt-2 space-y-1.5">
          {#each p.decision.stop_doing as line}
            <li class="flex gap-2 text-xs text-red-900/90">
              <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" aria-hidden="true"></span>
              <span>{line}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <details class="group mt-4 rounded-xl border border-zinc-200 bg-white/60 p-3">
      <summary
        class="cursor-pointer list-none text-xs font-semibold text-zinc-800 marker:content-none [&::-webkit-details-marker]:hidden"
      >
        <span class="group-open:underline">Blindspots, leverage, trajectory</span>
      </summary>
      <div class="mt-4 space-y-4 text-sm">
        {#if p.blindspots.length}
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Blindspots</p>
            <ul class="mt-2 space-y-3">
              {#each p.blindspots as b}
                <li class="rounded-lg border border-zinc-100 bg-zinc-50/80 p-2.5">
                  <p class="font-medium text-zinc-900">{b.issue}</p>
                  <p class="mt-1 text-xs text-zinc-600">{b.impact}</p>
                  <p class="mt-1 text-xs font-medium text-emerald-900">Fix: {b.fix}</p>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        <div class="grid gap-3 sm:grid-cols-3">
          {#if p.leverage.unfair_advantages.length}
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Unfair advantages</p>
              <ul class="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-zinc-800">
                {#each p.leverage.unfair_advantages as x}
                  <li>{x}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if p.leverage.underused_assets.length}
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Underused assets</p>
              <ul class="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-zinc-800">
                {#each p.leverage.underused_assets as x}
                  <li>{x}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if p.leverage.quick_wins.length}
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Quick wins</p>
              <ul class="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-zinc-800">
                {#each p.leverage.quick_wins as x}
                  <li>{x}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
        <div class="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
          <p class="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Trajectory</p>
          <p class="mt-1 text-xs text-zinc-800"><span class="font-semibold">Direction:</span> {p.trajectory.direction}</p>
          <p class="mt-1 text-xs text-zinc-800"><span class="font-semibold">Risk:</span> {p.trajectory.risk}</p>
          <p class="mt-1 text-xs text-zinc-800">
            <span class="font-semibold">Next critical move:</span>
            {p.trajectory.next_critical_move}
          </p>
        </div>
      </div>
    </details>

    <p class="mt-4 text-[10px] text-zinc-400">
      Updated {fmtDate(intelligence.generatedAt)}{#if intelligence.userQuery}
        · Q: {intelligence.userQuery}{/if}
    </p>
  </div>
  {/if}
{:else}
  <div class="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-600">
    No operator view yet. Regenerate insights below, or refresh connected accounts — the decision layer runs with your snapshot.
  </div>
{/if}

<style>
  .ihp-home {
    --ihp-border: var(--panel-border);
    --ihp-muted: var(--text-muted);
    --ihp-text: var(--text-primary);
    --ihp-soft: var(--text-secondary);
    padding: 1.1rem 1.15rem 1.2rem;
    border-radius: 18px;
    border: 1px solid var(--ihp-border);
    background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
    box-shadow: var(--shadow-tall-card, 0 12px 40px rgba(0, 0, 0, 0.35));
    color: var(--ihp-text);
    font-size: 13px;
    line-height: 1.45;
  }

  .ihp-home__head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .ihp-home__kicker {
    margin: 0;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ihp-muted);
  }

  .ihp-home__kicker--tight {
    margin-bottom: 6px;
  }

  .ihp-home__badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .ihp-home__pill {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
    border: 1px solid color-mix(in srgb, var(--accent-primary) 28%, var(--ihp-border));
    background: color-mix(in srgb, var(--accent-soft) 35%, transparent);
    color: var(--ihp-soft);
  }

  .ihp-home__conf {
    font-size: 11px;
    color: var(--ihp-muted);
  }

  .ihp-home__line {
    margin: 0 0 14px;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .ihp-home__grid3 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  @media (min-width: 520px) {
    .ihp-home__grid3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .ihp-home__cell {
    border: 1px solid var(--ihp-border);
    border-radius: 12px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--panel-surface-soft) 55%, transparent);
  }

  .ihp-home__cell-k {
    margin: 0 0 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ihp-muted);
  }

  .ihp-home__cell-v {
    margin: 0;
    font-size: 13px;
    color: var(--ihp-soft);
  }

  .ihp-home__decision {
    margin-top: 14px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--ihp-border);
    background: color-mix(in srgb, var(--panel-surface) 50%, transparent);
  }

  .ihp-home__do-now {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.45;
  }

  .ihp-home__why {
    margin: 0;
    font-size: 12px;
    color: var(--ihp-soft);
    line-height: 1.5;
  }

  .ihp-home__then-label {
    margin-top: 14px;
    margin-bottom: 6px;
  }

  .ihp-home__bullets {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    color: var(--ihp-soft);
  }

  .ihp-home__bullets li {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .ihp-home__bullet {
    margin-top: 5px;
    width: 5px;
    height: 5px;
    flex-shrink: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent-primary) 80%, var(--home-lime, #b8f24a));
  }

  .ihp-home__bullet--stop {
    background: color-mix(in srgb, #f87171 90%, transparent);
  }

  .ihp-home__bullets--stop {
    color: color-mix(in srgb, #fecaca 92%, var(--ihp-text));
  }

  .ihp-home__stop-k {
    margin: 14px 0 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: color-mix(in srgb, #f87171 85%, var(--ihp-muted));
  }

  .ihp-home__details {
    margin-top: 12px;
    border: 1px solid var(--ihp-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--panel-surface) 40%, transparent);
    overflow: hidden;
  }

  .ihp-home__summary {
    cursor: pointer;
    list-style: none;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ihp-soft);
  }

  .ihp-home__summary::-webkit-details-marker {
    display: none;
  }

  .ihp-home__more {
    padding: 0 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-size: 12px;
    border-top: 1px solid var(--ihp-border);
  }

  .ihp-home__blind-list {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .ihp-home__blind-item {
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--ihp-border);
    background: color-mix(in srgb, var(--bg-primary) 35%, transparent);
  }

  .ihp-home__blind-issue {
    margin: 0;
    font-weight: 600;
  }

  .ihp-home__blind-impact {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--ihp-soft);
  }

  .ihp-home__blind-fix {
    margin: 6px 0 0;
    font-size: 12px;
    font-weight: 600;
    color: color-mix(in srgb, #6ee7b7 75%, var(--ihp-soft));
  }

  .ihp-home__lev-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }

  @media (min-width: 560px) {
    .ihp-home__lev-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .ihp-home__list {
    margin: 6px 0 0;
    padding-left: 1.1rem;
    color: var(--ihp-soft);
    font-size: 12px;
  }

  .ihp-home__traj-box {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--ihp-border);
    background: color-mix(in srgb, var(--panel-surface-soft) 45%, transparent);
  }

  .ihp-home__traj-line {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--ihp-soft);
  }

  .ihp-home__traj-key {
    font-weight: 600;
    color: var(--ihp-text);
  }

  .ihp-home__footer {
    margin: 14px 0 0;
    font-size: 10px;
    color: var(--ihp-muted);
  }
</style>
