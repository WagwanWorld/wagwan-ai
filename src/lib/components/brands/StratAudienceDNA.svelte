<script lang="ts">
  export let demographics: {
    ageBuckets: Record<string, number>;
    genderSplit: { male: number; female: number; unknown: number };
    topCities: Array<{ city: string; pct: number }>;
    topCountries: Array<{ country: string; pct: number }>;
  } | null = null;

  export let audiencePortrait: {
    narrative: string;
    primaryDemographic: { ageRange: string; gender: string; topCities: string[]; topCountries: string[] };
    personas: Array<{ name: string; description: string }>;
  } | null = null;

  $: sortedAgeBuckets = demographics
    ? Object.entries(demographics.ageBuckets)
        .map(([label, pct]) => ({ label, pct }))
        .sort((a, b) => b.pct - a.pct)
    : [];

  $: genderSplit = demographics?.genderSplit ?? { male: 0, female: 0, unknown: 0 };

  $: dominantGenderPct = demographics
    ? Math.max(genderSplit.male, genderSplit.female)
    : 0;

  $: secondaryGenderPct = demographics
    ? Math.min(genderSplit.male, genderSplit.female)
    : 0;

  $: dominantLabel = genderSplit.male >= genderSplit.female ? 'Male' : 'Female';
  $: secondaryLabel = genderSplit.male >= genderSplit.female ? 'Female' : 'Male';
</script>

<div class="dna">
  {#if demographics === null}
    <div class="empty">
      <p class="empty-text">Audience data requires a business account with 100+ followers.</p>
    </div>
  {:else}
    {#if audiencePortrait?.narrative}
      <p class="narrative">{audiencePortrait.narrative}</p>
    {/if}

    <div class="dna-grid">
      <!-- Age -->
      <div class="dna-col">
        <span class="label">Age</span>
        <div class="age-bars">
          {#each sortedAgeBuckets as bucket}
            <div class="age-row">
              <span class="age-range">{bucket.label}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: {bucket.pct}%"></div>
              </div>
              <span class="age-pct">{bucket.pct}%</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Gender -->
      <div class="dna-col">
        <span class="label">Gender</span>
        <div class="gender-bar">
          <div class="seg seg-dominant" style="flex: {dominantGenderPct}"></div>
          <div class="seg seg-secondary" style="flex: {secondaryGenderPct}"></div>
          {#if genderSplit.unknown > 0}
            <div class="seg seg-unknown" style="flex: {genderSplit.unknown}"></div>
          {/if}
        </div>
        <div class="gender-rows">
          <div class="gender-row">
            <span class="gender-num">{genderSplit.male}%</span>
            <span class="gender-tag">Male</span>
          </div>
          <div class="gender-row">
            <span class="gender-num">{genderSplit.female}%</span>
            <span class="gender-tag">Female</span>
          </div>
          {#if genderSplit.unknown > 0}
            <div class="gender-row">
              <span class="gender-num gender-num--muted">{genderSplit.unknown}%</span>
              <span class="gender-tag">Unknown</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Geography -->
      <div class="dna-col">
        <span class="label">Geography</span>
        {#if demographics.topCities.length > 0}
          <div class="geo-group">
            <span class="sublabel">Cities</span>
            {#each demographics.topCities as item}
              <div class="geo-row">
                <span class="geo-name">{item.city}</span>
                <span class="geo-pct">{item.pct}%</span>
              </div>
            {/each}
          </div>
        {/if}
        {#if demographics.topCountries.length > 0}
          <div class="geo-group geo-group--countries">
            <span class="sublabel">Countries</span>
            {#each demographics.topCountries as item}
              <div class="geo-row">
                <span class="geo-name">{item.country}</span>
                <span class="geo-pct">{item.pct}%</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if audiencePortrait?.personas && audiencePortrait.personas.length > 0}
      <div class="personas">
        <span class="label">Personas</span>
        <div class="personas-grid">
          {#each audiencePortrait.personas as persona}
            <div class="persona-card">
              <h4 class="persona-name">{persona.name}</h4>
              <p class="persona-desc">{persona.description}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .dna {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  /* Narrative */
  .narrative {
    font-size: 14px;
    color: var(--g-text-3);
    line-height: 1.7;
    margin: 0;
    padding-left: 14px;
    border-left: 2px solid rgba(255,255,255,0.06);
  }

  /* Empty */
  .empty {
    padding: 24px 0;
  }
  .empty-text {
    font-size: 13px;
    color: var(--g-text-4);
    margin: 0;
    line-height: 1.6;
  }

  /* Label */
  .label {
    display: block;
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
    margin-bottom: 12px;
  }
  .sublabel {
    display: block;
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-text-ghost);
    margin-bottom: 6px;
  }

  /* 3-col grid */
  .dna-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border-top: 1px solid rgba(255,255,255,0.03);
  }
  .dna-col {
    padding: 16px 18px 18px 0;
    border-right: 1px solid rgba(255,255,255,0.03);
  }
  .dna-col:first-child { padding-left: 0; }
  .dna-col:last-child { border-right: none; padding-right: 0; padding-left: 18px; }
  .dna-col:nth-child(2) { padding-left: 18px; }

  /* Age bars */
  .age-bars {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .age-row {
    display: grid;
    grid-template-columns: 48px 1fr 34px;
    align-items: center;
    gap: 8px;
  }
  .age-range {
    font-family: var(--g-font-mono, monospace);
    font-size: 10px;
    font-weight: 500;
    color: var(--g-text-3);
    white-space: nowrap;
  }
  .bar-track {
    height: 4px;
    background: rgba(255,255,255,0.03);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: var(--g-accent, rgba(255,64,64,0.5));
    border-radius: 2px;
    transition: width var(--g-dur) var(--g-ease);
  }
  .age-pct {
    font-family: var(--g-font-mono, monospace);
    font-size: 10px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text);
    text-align: right;
  }

  /* Gender */
  .gender-bar {
    display: flex;
    height: 3px;
    width: 100%;
    overflow: hidden;
    margin-bottom: 14px;
    gap: 1px;
    border-radius: 2px;
  }
  .seg { height: 100%; }
  .seg-dominant { background: var(--g-accent, rgba(255,64,64,0.5)); }
  .seg-secondary { background: rgba(255,255,255,0.1); }
  .seg-unknown { background: rgba(255,255,255,0.04); }
  .gender-rows {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .gender-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .gender-num {
    font-size: 22px;
    font-weight: 300;
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--g-text);
  }
  .gender-num--muted { color: var(--g-text-3); }
  .gender-tag {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-text-ghost);
  }

  /* Geography */
  .geo-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .geo-group--countries {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.025);
  }
  .geo-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .geo-name {
    font-size: 13px;
    color: var(--g-text-3);
    line-height: 1.4;
  }
  .geo-pct {
    font-family: var(--g-font-mono, monospace);
    font-size: 10px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text-2);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Personas */
  .personas {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.03);
  }
  .personas-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .persona-card {
    padding: 14px;
    border-radius: 12px;
    background: rgba(255,255,255,0.015);
    border: 1px solid rgba(255,255,255,0.025);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .persona-name {
    font-size: 14px;
    font-weight: 400;
    color: var(--g-text);
    margin: 0;
    line-height: 1.2;
  }
  .persona-desc {
    font-size: 12px;
    line-height: 1.6;
    color: var(--g-text-3);
    margin: 0;
  }

  @media (max-width: 640px) {
    .dna-grid { grid-template-columns: 1fr; }
    .dna-col {
      padding: 14px 0;
      border-right: none;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .dna-col:last-child { padding-left: 0; border-bottom: none; }
    .dna-col:nth-child(2) { padding-left: 0; }
    .personas-grid { grid-template-columns: 1fr; }
  }
</style>
