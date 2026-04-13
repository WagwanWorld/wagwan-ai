<script lang="ts">
  import type {
    InferenceEvidenceSource,
    InferenceIdentityWrapper,
    InferenceLifeDomain,
  } from '$lib/types/inferenceIdentity';
  import InferenceFocusGrid from '$lib/components/InferenceFocusGrid.svelte';

  /** Trimmed wrapper from API (history already shortened). */
  export let inference: InferenceIdentityWrapper | null = null;

  type FocusItem = { kind: 'interest' | 'need'; text: string };

  function buildFocusItems(c: NonNullable<InferenceIdentityWrapper['current']>): FocusItem[] {
    const interests = [...c.interests.explicit.slice(0, 6), ...c.interests.latent.slice(0, 6)]
      .map(t => String(t).trim())
      .filter(Boolean);
    const needs = [...c.needs.immediate.slice(0, 6), ...c.needs.emerging.slice(0, 6)]
      .map(t => String(t).trim())
      .filter(Boolean);
    const out: FocusItem[] = [];
    for (const text of interests) out.push({ kind: 'interest', text });
    for (const text of needs) out.push({ kind: 'need', text });
    return out.slice(0, 12);
  }

  /** `home`: scores-first, dark glass; `default`: light card for other surfaces. */
  export let variant: 'default' | 'home' = 'default';

  function pct(conf: number): string {
    return `${Math.round(Math.min(1, Math.max(0, conf)) * 100)}%`;
  }

  function scoreBarClass(score: number): string {
    if (score >= 66) return 'from-violet-500 to-violet-600';
    if (score >= 33) return 'from-blue-500 to-indigo-600';
    return 'from-zinc-400 to-zinc-500';
  }

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return iso;
      return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  }

  function sourceBadgeClass(src: InferenceEvidenceSource): string {
    switch (src) {
      case 'instagram':
        return 'bg-pink-100 text-pink-900 ring-pink-200';
      case 'spotify':
      case 'apple_music':
        return 'bg-green-100 text-green-900 ring-green-200';
      case 'youtube':
      case 'google':
        return 'bg-red-100 text-red-900 ring-red-200';
      case 'linkedin':
        return 'bg-sky-100 text-sky-900 ring-sky-200';
      case 'manual':
        return 'bg-amber-100 text-amber-900 ring-amber-200';
      default:
        return 'bg-zinc-100 text-zinc-700 ring-zinc-200';
    }
  }

  function formatSource(src: string): string {
    return src.replace(/_/g, ' ');
  }

  function snipChip(s: string, max: number): string {
    const t = s.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  function nextMovesStrip(
    c: NonNullable<InferenceIdentityWrapper['current']>,
    sortedDomains: InferenceLifeDomain[],
  ): string[] {
    const out: string[] = [];
    const pr = c.predictive_read;
    if (pr?.next_moves?.length) {
      out.push(...pr.next_moves.slice(0, 3));
    } else {
      out.push(...c.predictions.likely_next_actions.slice(0, 3));
    }
    if (out.length < 3 && Array.isArray(sortedDomains)) {
      const extra = sortedDomains.find(d => d.id !== 'shopping_style' && d.likely_next?.[0]);
      const line = extra?.likely_next?.[0];
      if (line && !out.includes(line)) out.push(line);
    }
    return out.slice(0, 3);
  }

  function isPredictiveShoppingMusic(id: string): boolean {
    return id === 'shopping_style' || id === 'music' || id === 'tech_media';
  }
</script>

{#if inference?.current}
  {@const c = inference.current}
  {@const sortedDomains = c.life_domains
    ? [...c.life_domains].sort((a, b) => b.salience_0_100 - a.salience_0_100)
    : []}
  {@const hasDomains = sortedDomains.length > 0}
  {@const lead =
    c.predictive_read?.you_in_one_line?.trim() || c.intent.primary}
  {@const nextStrip = nextMovesStrip(c, sortedDomains)}
  {@const domainChips = sortedDomains.slice(0, 4)}
  {@const commerceChips = (c.predictive_read?.commerce_affinity ?? []).slice(0, 2)}
  {@const focusItems = buildFocusItems(c)}
  {#if variant === 'home'}
    <div class="inf-home">
      <p class="inf-home__kicker">Scores</p>
      <div class="inf-home__score-grid">
        {#each [{ k: 'Builder', v: c.derived_signals.builder_score }, { k: 'Creator', v: c.derived_signals.creator_score }, { k: 'Consumer', v: c.derived_signals.consumer_score }, { k: 'Momentum', v: c.derived_signals.momentum_score }] as row}
          <div class="inf-home__score-card">
            <p class="inf-home__score-label">{row.k}</p>
            <p class="inf-home__score-val">{row.v}</p>
            <div class="inf-home__score-track" aria-hidden="true">
              <span class="inf-home__score-fill" style="width: {Math.min(100, row.v)}%"></span>
            </div>
          </div>
        {/each}
      </div>
      <div class="inf-home__taste-risk">
        <p>
          <span class="inf-home__tw-label">Taste</span>
          {c.derived_signals.taste_profile}
        </p>
        <p>
          <span class="inf-home__tw-label">Risk</span>
          {c.derived_signals.risk_appetite}
        </p>
      </div>

      <InferenceFocusGrid items={focusItems} variant="home" />

      <div class="inf-home__content-block">
        <p class="inf-home__subkicker">Content profile</p>
        <p class="inf-home__content-style">{c.content_profile.style}</p>
        {#if c.content_profile.themes?.length}
          <p class="inf-home__content-themes">{c.content_profile.themes.join(' · ')}</p>
        {/if}
      </div>

      <details class="inf-home__details">
        <summary class="inf-home__summary">Behaviour &amp; tempo</summary>
        <div class="inf-home__behaviour">
          <div>
            <p class="inf-home__bh-title">Creation</p>
            <p>{c.behavior.creation_patterns.frequency}</p>
            <p class="inf-home__bh-muted">Mix: {c.behavior.creation_patterns.original_vs_consumption_ratio}</p>
          </div>
          <div>
            <p class="inf-home__bh-title">Engagement</p>
            <p>{c.behavior.engagement_patterns.interaction_depth}</p>
            <p class="inf-home__bh-muted">{c.behavior.engagement_patterns.network_type}</p>
          </div>
          <div>
            <p class="inf-home__bh-title">Temporal</p>
            <p>{c.behavior.temporal_patterns.consistency}</p>
            <p>{c.behavior.temporal_patterns.recent_trend}</p>
          </div>
        </div>
      </details>

      <div class="inf-home__read-block">
        <p class="inf-home__kicker inf-home__kicker--soft">Your read</p>
        <p class="inf-home__lead">{lead}</p>
        {#if nextStrip.length}
          <p class="inf-home__subkicker inf-home__subkicker--spaced">Likely next</p>
          <ul class="inf-home__next-list">
            {#each nextStrip as line}
              <li>
                <span class="inf-home__dot" aria-hidden="true"></span>
                {line}
              </li>
            {/each}
          </ul>
        {/if}
        {#if domainChips.length || commerceChips.length || c.intent.secondary?.length}
          <div class="inf-home__chips">
            {#each domainChips as d}
              <span class="inf-home__chip">{d.label}</span>
            {/each}
            {#each commerceChips as x}
              <span class="inf-home__chip inf-home__chip--accent">{snipChip(x, 48)}</span>
            {/each}
            {#each (c.intent.secondary ?? []).slice(0, 3) as s}
              <span class="inf-home__chip">{snipChip(s, 40)}</span>
            {/each}
          </div>
        {/if}
        <p class="inf-home__meta">Updated {fmtDate(inference.inferredAt)}</p>
      </div>

      <details class="inf-home__details inf-home__details--heavy">
        <summary class="inf-home__summary">Model detail &amp; domains</summary>
        <div class="inf-home__detail-inner">
          <p class="inf-home__revision">Model revision {inference.revision} · schema v{inference.schemaVersion}</p>

          {#if !hasDomains}
            <p class="inf-home__muted">
              Domain breakdown appears after a refresh with the multi-domain model. Below is the full aggregate view.
            </p>
          {:else}
            <div class="inf-home__domain-stack">
              {#each sortedDomains as d}
                <article class="inf-home__domain-card">
                  <div class="inf-home__domain-head">
                    <h3 class="inf-home__domain-title">{d.label}</h3>
                    <span class="inf-home__domain-meta"
                      >{pct(d.confidence)} · salience {d.salience_0_100}</span
                    >
                  </div>
                  {#if isPredictiveShoppingMusic(d.id)}
                    {#if d.signals?.length}
                      <p class="inf-home__subkicker inf-home__subkicker--tight">Signals</p>
                      <div class="inf-home__signal-row">
                        {#each d.signals.slice(0, 10) as sig}
                          <span class="inf-home__signal-pill">{sig}</span>
                        {/each}
                      </div>
                    {/if}
                    {#if d.likely_next?.length}
                      <p class="inf-home__subkicker inf-home__subkicker--tight">In this area, maybe</p>
                      <ul class="inf-home__list inf-home__list--tight">
                        {#each d.likely_next as x}
                          <li>{x}</li>
                        {/each}
                      </ul>
                    {/if}
                  {/if}
                  <details class="inf-home__nested">
                    <summary class="inf-home__nested-sum">Full narrative · evidence</summary>
                    <div class="inf-home__nested-body">
                      <p class="inf-home__narrative">{d.narrative}</p>
                      {#if d.consumption_vs_creation?.trim()}
                        <p class="inf-home__cv">
                          <span class="inf-home__cv-key">Create vs consume:</span>
                          {d.consumption_vs_creation}
                        </p>
                      {/if}
                      {#if d.evidence?.length}
                        <ul class="inf-home__ev-list">
                          {#each d.evidence as ev}
                            <li class="inf-home__ev-row">
                              <span
                                class={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ${sourceBadgeClass(ev.source)}`}
                              >
                                {formatSource(ev.source)}
                              </span>
                              <span class="inf-home__ev-text">{ev.text}</span>
                            </li>
                          {/each}
                        </ul>
                      {/if}
                      {#if !isPredictiveShoppingMusic(d.id) && d.likely_next?.length}
                        <p class="inf-home__subkicker inf-home__subkicker--tight">Likely next</p>
                        <ul class="inf-home__list inf-home__list--tight">
                          {#each d.likely_next as x}
                            <li>{x}</li>
                          {/each}
                        </ul>
                      {/if}
                    </div>
                  </details>
                </article>
              {/each}
            </div>
          {/if}

          <div class="inf-home__stage-grid">
            <div class="inf-home__stage-card">
              <p class="inf-home__subkicker">Stage</p>
              <p class="inf-home__stage-val">{c.stage.category}</p>
              <p class="inf-home__muted">{pct(c.stage.confidence)} confidence</p>
            </div>
            <div class="inf-home__stage-card">
              <p class="inf-home__subkicker">Trajectory</p>
              <p class="inf-home__stage-val">{c.trajectory.direction}</p>
              <p class="inf-home__muted">Velocity: {c.trajectory.velocity}</p>
            </div>
          </div>

          <details class="inf-home__details">
            <summary class="inf-home__summary">Longer-term predictions</summary>
            <div class="inf-home__predictions">
              {#if c.predictions.short_term?.length}
                <p class="inf-home__bh-title">Short term</p>
                <ul class="inf-home__list inf-home__list--tight">
                  {#each c.predictions.short_term as x}
                    <li>{x}</li>
                  {/each}
                </ul>
              {/if}
              {#if c.predictions.long_term?.length}
                <p class="inf-home__bh-title inf-home__bh-title--spaced">Long term</p>
                <ul class="inf-home__list inf-home__list--tight">
                  {#each c.predictions.long_term as x}
                    <li>{x}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          </details>

          {#if c.trajectory.stage_shift_signals?.length}
            <div class="inf-home__shift">
              <p class="inf-home__subkicker">Stage shift signals</p>
              <ul class="inf-home__list inf-home__list--tight">
                {#each c.trajectory.stage_shift_signals as x}
                  <li>{x}</li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if inference.history?.length}
            <details class="inf-home__details">
              <summary class="inf-home__summary">Past revisions ({inference.history.length})</summary>
              <ul class="inf-home__history">
                {#each [...inference.history].reverse() as h}
                  <li class="inf-home__hist-row">
                    <span class="inf-home__hist-rev">r{h.revision}</span>
                    <span>{fmtDate(h.inferredAt)}</span>
                    {#if h.intentPrimary}
                      <span class="inf-home__muted">— {h.intentPrimary}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </details>
          {/if}
        </div>
      </details>
    </div>
  {:else}
  <div class="rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/50 to-white p-4 shadow-sm sm:p-5">
    <p class="text-[10px] font-bold uppercase tracking-widest text-violet-700/90">Your read</p>
    <p class="mt-2 text-sm font-medium leading-relaxed text-zinc-900">{lead}</p>

    {#if nextStrip.length}
      <div class="mt-4">
        <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Likely next</p>
        <ul class="mt-2 space-y-2">
          {#each nextStrip as line}
            <li class="flex gap-2 text-xs leading-snug text-zinc-800">
              <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-500" aria-hidden="true"></span>
              <span>{line}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if domainChips.length || commerceChips.length || c.intent.secondary?.length}
      <div class="mt-4 flex flex-wrap gap-1.5">
        {#each domainChips as d}
          <span class="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-800 ring-1 ring-zinc-200/90">
            {d.label}
          </span>
        {/each}
        {#each commerceChips as x}
          <span class="rounded-full bg-violet-100/80 px-2.5 py-0.5 text-[11px] text-violet-950 ring-1 ring-violet-200/80">
            {snipChip(x, 48)}
          </span>
        {/each}
        {#each (c.intent.secondary ?? []).slice(0, 3) as s}
          <span class="rounded-full bg-zinc-100/90 px-2.5 py-0.5 text-[11px] text-zinc-700">{snipChip(s, 40)}</span>
        {/each}
      </div>
    {/if}

    <p class="mt-3 text-[10px] text-zinc-400">Updated {fmtDate(inference.inferredAt)}</p>

    <details class="group mt-4 rounded-xl border border-zinc-200/90 bg-white/60">
      <summary
        class="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden"
      >
        <span class="flex items-center justify-between gap-2">
          More details
          <span class="text-xs font-normal text-violet-700 group-open:hidden">Show</span>
          <span class="hidden text-xs font-normal text-violet-700 group-open:inline">Hide</span>
        </span>
      </summary>

      <div class="space-y-4 border-t border-zinc-100 px-3 pb-4 pt-3">
        <p class="text-[10px] text-zinc-500">Model revision {inference.revision} · schema v{inference.schemaVersion}</p>

        {#if !hasDomains}
          <p class="text-xs text-zinc-600">
            Domain breakdown appears after a refresh with the multi-domain model. Below is the full aggregate view.
          </p>
        {:else}
          <div class="space-y-3">
            {#each sortedDomains as d}
              <article class="rounded-xl border border-zinc-100 bg-white/90 px-3 py-3 text-xs">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <h3 class="text-sm font-bold text-zinc-900">{d.label}</h3>
                  <span class="text-[10px] tabular-nums text-zinc-500"
                    >{pct(d.confidence)} · salience {d.salience_0_100}</span
                  >
                </div>
                {#if isPredictiveShoppingMusic(d.id)}
                  {#if d.signals?.length}
                    <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Signals</p>
                    <div class="mt-1 flex flex-wrap gap-1">
                      {#each d.signals.slice(0, 10) as sig}
                        <span class="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700">{sig}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if d.likely_next?.length}
                    <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-violet-700/90">In this area, maybe</p>
                    <ul class="mt-1 list-inside list-disc space-y-0.5 text-zinc-800">
                      {#each d.likely_next as x}
                        <li>{x}</li>
                      {/each}
                    </ul>
                  {/if}
                {/if}
                <details class="mt-2 rounded-lg bg-zinc-50/80">
                  <summary
                    class="cursor-pointer px-2 py-2 text-[11px] font-medium text-zinc-700 marker:content-none [&::-webkit-details-marker]:hidden"
                  >
                    Full narrative · evidence
                  </summary>
                  <div class="border-t border-zinc-100 px-2 py-2 text-zinc-700">
                    <p class="leading-relaxed">{d.narrative}</p>
                    {#if d.consumption_vs_creation?.trim()}
                      <p class="mt-2 text-[11px] text-zinc-600">
                        <span class="font-semibold text-zinc-800">Create vs consume:</span>
                        {d.consumption_vs_creation}
                      </p>
                    {/if}
                    {#if d.evidence?.length}
                      <ul class="mt-2 space-y-1.5 text-[11px]">
                        {#each d.evidence as ev}
                          <li class="flex flex-wrap items-start gap-2">
                            <span
                              class={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ${sourceBadgeClass(ev.source)}`}
                            >
                              {formatSource(ev.source)}
                            </span>
                            <span class="min-w-0 leading-snug">{ev.text}</span>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                    {#if !isPredictiveShoppingMusic(d.id) && d.likely_next?.length}
                      <p class="mt-2 text-[10px] font-bold uppercase text-zinc-500">Likely next</p>
                      <ul class="mt-1 list-inside list-disc">
                        {#each d.likely_next as x}
                          <li>{x}</li>
                        {/each}
                      </ul>
                    {/if}
                  </div>
                </details>
              </article>
            {/each}
          </div>
        {/if}

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-zinc-100 bg-white/80 px-3 py-3">
            <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Stage</p>
            <p class="mt-1 text-sm font-semibold text-zinc-900">{c.stage.category}</p>
            <p class="mt-1 text-xs tabular-nums text-zinc-600">{pct(c.stage.confidence)} confidence</p>
          </div>
          <div class="rounded-xl border border-zinc-100 bg-white/80 px-3 py-3">
            <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Trajectory</p>
            <p class="mt-1 text-sm font-semibold text-zinc-900">{c.trajectory.direction}</p>
            <p class="mt-0.5 text-xs text-zinc-600">Velocity: {c.trajectory.velocity}</p>
          </div>
        </div>

        <div>
          <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Scores</p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {#each [{ k: 'Builder', v: c.derived_signals.builder_score }, { k: 'Creator', v: c.derived_signals.creator_score }, { k: 'Consumer', v: c.derived_signals.consumer_score }, { k: 'Momentum', v: c.derived_signals.momentum_score }] as row}
              <div class="rounded-xl border border-zinc-100 bg-white/90 px-2 py-2">
                <p class="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{row.k}</p>
                <p class="text-lg font-bold tabular-nums text-zinc-900">{row.v}</p>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    class={`h-full rounded-full bg-gradient-to-r ${scoreBarClass(row.v)}`}
                    style="width: {Math.min(100, row.v)}%"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
          <p class="mt-3 text-xs leading-relaxed text-zinc-600">
            <span class="font-medium text-zinc-800">Taste:</span>
            {c.derived_signals.taste_profile}
            <span class="mx-1 text-zinc-400">·</span>
            <span class="font-medium text-zinc-800">Risk:</span>
            {c.derived_signals.risk_appetite}
          </p>
        </div>

        <details class="rounded-xl border border-zinc-100 bg-white/70">
          <summary
            class="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-zinc-800 marker:content-none [&::-webkit-details-marker]:hidden"
          >
            Behaviour & tempo
          </summary>
          <div class="space-y-3 border-t border-zinc-100 px-3 pb-3 pt-2 text-xs text-zinc-700">
            <div>
              <p class="font-semibold text-zinc-900">Creation</p>
              <p class="mt-0.5">{c.behavior.creation_patterns.frequency}</p>
              <p class="mt-1 text-zinc-600">Mix: {c.behavior.creation_patterns.original_vs_consumption_ratio}</p>
            </div>
            <div>
              <p class="font-semibold text-zinc-900">Engagement</p>
              <p class="mt-0.5">{c.behavior.engagement_patterns.interaction_depth}</p>
              <p class="mt-0.5 text-zinc-600">{c.behavior.engagement_patterns.network_type}</p>
            </div>
            <div>
              <p class="font-semibold text-zinc-900">Temporal</p>
              <p class="mt-0.5">{c.behavior.temporal_patterns.consistency}</p>
              <p class="mt-0.5">{c.behavior.temporal_patterns.recent_trend}</p>
            </div>
          </div>
        </details>

        <InferenceFocusGrid items={focusItems} variant="default" />

        <div class="rounded-xl border border-zinc-100 bg-white/80 px-3 py-3 text-xs">
          <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Content profile</p>
          <p class="mt-2 font-medium text-zinc-900">{c.content_profile.style}</p>
          {#if c.content_profile.themes?.length}
            <p class="mt-2 leading-relaxed text-zinc-700">{c.content_profile.themes.join(' · ')}</p>
          {/if}
        </div>

        <details class="rounded-xl border border-zinc-100 bg-white/70">
          <summary
            class="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-zinc-800 marker:content-none [&::-webkit-details-marker]:hidden"
          >
            Longer-term predictions
          </summary>
          <div class="border-t border-zinc-100 px-3 pb-3 pt-2 text-xs text-zinc-700">
            {#if c.predictions.short_term?.length}
              <p class="font-semibold text-zinc-900">Short term</p>
              <ul class="mt-1 list-inside list-disc">
                {#each c.predictions.short_term as x}
                  <li>{x}</li>
                {/each}
              </ul>
            {/if}
            {#if c.predictions.long_term?.length}
              <p class="mt-2 font-semibold text-zinc-900">Long term</p>
              <ul class="mt-1 list-inside list-disc">
                {#each c.predictions.long_term as x}
                  <li>{x}</li>
                {/each}
              </ul>
            {/if}
          </div>
        </details>

        {#if c.trajectory.stage_shift_signals?.length}
          <div class="rounded-xl border border-amber-100/80 bg-amber-50/40 px-3 py-3 text-xs text-amber-950/90">
            <p class="text-[10px] font-bold uppercase tracking-widest text-amber-900/70">Stage shift signals</p>
            <ul class="mt-2 list-inside list-disc space-y-0.5">
              {#each c.trajectory.stage_shift_signals as x}
                <li>{x}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if inference.history?.length}
          <details class="rounded-xl border border-zinc-100 bg-zinc-50/50">
            <summary
              class="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-zinc-700 marker:content-none [&::-webkit-details-marker]:hidden"
            >
              Past revisions ({inference.history.length})
            </summary>
            <ul class="max-h-40 space-y-1.5 overflow-auto border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-600">
              {#each [...inference.history].reverse() as h}
                <li class="flex flex-wrap gap-x-2 border-b border-zinc-100/80 pb-1.5 last:border-0">
                  <span class="font-semibold text-zinc-800">r{h.revision}</span>
                  <span>{fmtDate(h.inferredAt)}</span>
                  {#if h.intentPrimary}
                    <span class="text-zinc-500">— {h.intentPrimary}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </details>
        {/if}
      </div>
    </details>
  </div>
  {/if}
{/if}

<style>
  .inf-home {
    --inf-border: var(--panel-border);
    --inf-surface: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
    --inf-muted: var(--text-muted);
    --inf-text: var(--text-primary);
    --inf-soft: var(--text-secondary);
    padding: 1.1rem 1.15rem 1.25rem;
    border-radius: 18px;
    border: 1px solid var(--inf-border);
    background: var(--inf-surface);
    box-shadow: var(--shadow-tall-card, 0 12px 40px rgba(0, 0, 0, 0.35));
    color: var(--inf-text);
    font-size: 13px;
    line-height: 1.5;
  }

  .inf-home__kicker {
    margin: 0 0 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--inf-muted);
  }

  .inf-home__kicker--soft {
    opacity: 0.95;
    margin-bottom: 6px;
  }

  .inf-home__score-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  @media (min-width: 520px) {
    .inf-home__score-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .inf-home__score-card {
    border: 1px solid var(--inf-border);
    border-radius: 12px;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--panel-surface-soft) 70%, transparent);
  }

  .inf-home__score-label {
    margin: 0;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--inf-muted);
  }

  .inf-home__score-val {
    margin: 4px 0 6px;
    font-size: 1.35rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .inf-home__score-track {
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--inf-muted) 22%, transparent);
    overflow: hidden;
  }

  .inf-home__score-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--home-lime, #b8f24a) 85%, var(--accent-primary)),
      var(--accent-primary)
    );
  }

  .inf-home__taste-risk {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    color: var(--inf-soft);
  }

  .inf-home__taste-risk p {
    margin: 0;
  }

  .inf-home__tw-label {
    display: inline-block;
    min-width: 2.75rem;
    margin-right: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--inf-muted);
  }

  .inf-home__subkicker {
    margin: 0 0 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--inf-muted);
  }

  .inf-home__subkicker--spaced {
    margin-top: 12px;
  }

  .inf-home__subkicker--tight {
    margin-top: 10px;
    margin-bottom: 4px;
  }

  .inf-home__list {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 12px;
    color: var(--inf-soft);
  }

  .inf-home__list li {
    margin-bottom: 4px;
  }

  .inf-home__list--tight {
    padding-left: 1rem;
  }

  .inf-home__content-block {
    margin-top: 14px;
    padding: 12px;
    border: 1px solid var(--inf-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--panel-surface-soft) 50%, transparent);
  }

  .inf-home__content-style {
    margin: 6px 0 0;
    font-weight: 600;
    font-size: 13px;
  }

  .inf-home__content-themes {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--inf-soft);
    line-height: 1.55;
  }

  .inf-home__details {
    margin-top: 12px;
    border: 1px solid var(--inf-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--panel-surface) 40%, transparent);
    overflow: hidden;
  }

  .inf-home__details--heavy {
    margin-top: 16px;
  }

  .inf-home__summary {
    cursor: pointer;
    list-style: none;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--inf-soft);
    border-bottom: 1px solid transparent;
  }

  .inf-home__summary::-webkit-details-marker {
    display: none;
  }

  .inf-home__details[open] .inf-home__summary {
    border-bottom-color: var(--inf-border);
  }

  .inf-home__behaviour {
    padding: 12px 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 12px;
    color: var(--inf-soft);
  }

  .inf-home__bh-title {
    margin: 0 0 4px;
    font-weight: 600;
    font-size: 12px;
    color: var(--inf-text);
  }

  .inf-home__bh-muted {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--inf-muted);
  }

  .inf-home__read-block {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--inf-border);
  }

  .inf-home__lead {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.55;
    color: var(--inf-text);
  }

  .inf-home__next-list {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    color: var(--inf-soft);
  }

  .inf-home__next-list li {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 6px;
  }

  .inf-home__dot {
    margin-top: 6px;
    width: 5px;
    height: 5px;
    flex-shrink: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent-primary) 75%, var(--home-lime, #b8f24a));
  }

  .inf-home__chips {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .inf-home__chip {
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 11px;
    border: 1px solid var(--inf-border);
    background: color-mix(in srgb, var(--panel-surface-soft) 65%, transparent);
    color: var(--inf-soft);
  }

  .inf-home__chip--accent {
    border-color: color-mix(in srgb, var(--accent-primary) 35%, var(--inf-border));
    color: var(--inf-text);
  }

  .inf-home__meta {
    margin: 10px 0 0;
    font-size: 10px;
    color: var(--inf-muted);
  }

  .inf-home__detail-inner {
    padding: 12px 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .inf-home__revision {
    margin: 0;
    font-size: 10px;
    color: var(--inf-muted);
  }

  .inf-home__muted {
    margin: 0;
    font-size: 12px;
    color: var(--inf-muted);
  }

  .inf-home__domain-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .inf-home__domain-card {
    border: 1px solid var(--inf-border);
    border-radius: 12px;
    padding: 10px 10px 8px;
    font-size: 12px;
    background: color-mix(in srgb, var(--panel-surface-soft) 45%, transparent);
  }

  .inf-home__domain-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 6px;
    align-items: baseline;
  }

  .inf-home__domain-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
  }

  .inf-home__domain-meta {
    font-size: 10px;
    color: var(--inf-muted);
    font-variant-numeric: tabular-nums;
  }

  .inf-home__signal-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .inf-home__signal-pill {
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 10px;
    background: color-mix(in srgb, var(--panel-surface) 80%, transparent);
    border: 1px solid var(--inf-border);
  }

  .inf-home__nested {
    margin-top: 8px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--inf-border) 80%, transparent);
    background: color-mix(in srgb, var(--bg-primary) 40%, transparent);
  }

  .inf-home__nested-sum {
    cursor: pointer;
    list-style: none;
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--inf-soft);
  }

  .inf-home__nested-sum::-webkit-details-marker {
    display: none;
  }

  .inf-home__nested-body {
    padding: 8px 10px 10px;
    border-top: 1px solid var(--inf-border);
    font-size: 11px;
    color: var(--inf-soft);
  }

  .inf-home__narrative {
    margin: 0;
    line-height: 1.55;
  }

  .inf-home__cv {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--inf-muted);
  }

  .inf-home__cv-key {
    font-weight: 600;
    color: var(--inf-text);
  }

  .inf-home__ev-list {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .inf-home__ev-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .inf-home__ev-text {
    min-width: 0;
    line-height: 1.45;
  }

  .inf-home__stage-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .inf-home__stage-card {
    border: 1px solid var(--inf-border);
    border-radius: 10px;
    padding: 10px;
    background: color-mix(in srgb, var(--panel-surface-soft) 50%, transparent);
  }

  .inf-home__stage-val {
    margin: 4px 0 2px;
    font-weight: 600;
    font-size: 13px;
  }

  .inf-home__predictions {
    padding: 10px 12px 12px;
    font-size: 12px;
    color: var(--inf-soft);
  }

  .inf-home__bh-title--spaced {
    margin-top: 12px;
  }

  .inf-home__shift {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--accent-primary) 22%, var(--inf-border));
    background: color-mix(in srgb, var(--accent-soft) 18%, transparent);
    font-size: 12px;
  }

  .inf-home__history {
    margin: 0;
    padding: 8px 10px 10px;
    list-style: none;
    max-height: 10rem;
    overflow: auto;
    font-size: 11px;
  }

  .inf-home__hist-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--inf-border);
  }

  .inf-home__hist-row:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .inf-home__hist-rev {
    font-weight: 700;
  }
</style>
