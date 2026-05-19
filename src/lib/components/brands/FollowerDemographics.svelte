<script lang="ts">
  export let age: Array<{ dimensionValue: string; count: number; percentage: number }> = [];
  export let gender: Array<{ dimensionValue: string; count: number; percentage: number }> = [];
  export let city: Array<{ dimensionValue: string; count: number; percentage: number }> = [];
  export let country: Array<{ dimensionValue: string; count: number; percentage: number }> = [];
  export let loading: boolean = false;

  $: hasData = gender.length > 0 || age.length > 0 || city.length > 0 || country.length > 0;

  // Gender donut
  $: genderMap = (() => {
    const m: Record<string, number> = { male: 0, female: 0, other: 0 };
    for (const g of gender) {
      const key = g.dimensionValue.toLowerCase();
      if (key === 'male' || key === 'm') m.male = g.percentage;
      else if (key === 'female' || key === 'f') m.female = g.percentage;
      else m.other += g.percentage;
    }
    return m;
  })();

  const donutR = 40;
  const donutStroke = 8;
  const donutCirc = 2 * Math.PI * donutR;

  $: genderArcs = (() => {
    const segments = [
      { key: 'male', pct: genderMap.male, color: '#E8833A' },
      { key: 'female', pct: genderMap.female, color: '#E87FA8' },
      { key: 'other', pct: genderMap.other, color: '#4d7cff' },
    ].filter((s) => s.pct > 0);

    let offset = 0;
    return segments.map((s) => {
      const dash = (s.pct / 100) * donutCirc;
      const gap = donutCirc - dash;
      const o = offset;
      offset += dash;
      return { ...s, dash, gap, offset: o };
    });
  })();

  // Age bars
  $: maxAgePct = Math.max(...age.map((a) => a.percentage), 1);

  // Top 3 cities / countries
  $: topCities = [...city].sort((a, b) => b.percentage - a.percentage).slice(0, 3);
  $: topCountries = [...country].sort((a, b) => b.percentage - a.percentage).slice(0, 3);
  $: maxCityPct = Math.max(...topCities.map((c) => c.percentage), 1);
  $: maxCountryPct = Math.max(...topCountries.map((c) => c.percentage), 1);
</script>

<div class="bs-card">
  <span class="card-label">AUDIENCE DEMOGRAPHICS</span>

  {#if loading}
    <div class="empty">
      <div class="pulse-bar"></div>
      <div class="pulse-bar short"></div>
    </div>
  {:else if !hasData}
    <div class="empty">
      <p class="empty-text">Run demographics sync to populate audience data.</p>
    </div>
  {:else}
    <div class="demo-grid">
      <!-- Gender donut -->
      <div class="quad quad-gender">
        <span class="section-label gender-label">GENDER</span>
        <div class="donut-wrap">
          <svg viewBox="0 0 100 100" class="donut-svg">
            {#each genderArcs as arc}
              <circle
                cx="50"
                cy="50"
                r={donutR}
                fill="none"
                stroke={arc.color}
                stroke-width={donutStroke}
                stroke-dasharray="{arc.dash} {arc.gap}"
                stroke-dashoffset={-arc.offset}
                stroke-linecap="round"
                transform="rotate(-90 50 50)"
              />
            {/each}
          </svg>
          <div class="donut-legend">
            {#each genderArcs as arc}
              <div class="legend-row">
                <span class="legend-dot" style="background:{arc.color}"></span>
                <span class="legend-label">{arc.key}</span>
                <span class="legend-pct">{arc.pct.toFixed(1)}%</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Age bars -->
      <div class="quad quad-age">
        <span class="section-label age-label">AGE</span>
        <div class="bar-list">
          {#each age.slice(0, 3) as bucket}
            <div class="bar-row">
              <span class="bar-label">{bucket.dimensionValue}</span>
              <div class="bar-track">
                <div
                  class="bar-fill age-fill"
                  style="width:{(bucket.percentage / maxAgePct) *
                    100}%; background: linear-gradient(90deg, #E8833A, #4d7cff);"
                ></div>
              </div>
              <span class="bar-pct">{bucket.percentage.toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Top cities -->
      <div class="quad quad-cities">
        <span class="section-label cities-label">TOP CITIES</span>
        <div class="bar-list">
          {#each topCities as item, i}
            <div class="bar-row">
              <span class="bar-label">{item.dimensionValue}</span>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  style="width:{(item.percentage / maxCityPct) *
                    100}%; background: #E8833A; opacity:{1 - i * 0.15};"
                ></div>
              </div>
              <span class="bar-pct">{item.percentage.toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Top countries -->
      <div class="quad quad-countries">
        <span class="section-label countries-label">TOP COUNTRIES</span>
        <div class="bar-list">
          {#each topCountries as item, i}
            <div class="bar-row">
              <span class="bar-label">{item.dimensionValue}</span>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  style="width:{(item.percentage / maxCountryPct) *
                    100}%; background: #4d7cff; opacity:{1 - i * 0.15};"
                ></div>
              </div>
              <span class="bar-pct">{item.percentage.toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .bs-card {
    position: relative;
    border-radius: 14px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.035);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  .empty {
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .empty-text {
    font-family: 'PP Mori', sans-serif;
    font-size: 13px;
    color: #4a4a50;
    margin: 0;
    line-height: 1.6;
  }
  .pulse-bar {
    height: 10px;
    width: 60%;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .pulse-bar.short {
    width: 35%;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }

  /* 4-column inline row */
  .demo-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .quad {
    padding: 14px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Color-coded cards */
  .quad-gender {
    background: linear-gradient(145deg, rgba(74, 222, 128, 0.06), rgba(74, 222, 128, 0.02));
    border: 1px solid rgba(74, 222, 128, 0.12);
  }
  .quad-age {
    background: linear-gradient(145deg, rgba(77, 124, 255, 0.06), rgba(77, 124, 255, 0.02));
    border: 1px solid rgba(77, 124, 255, 0.12);
  }
  .quad-cities {
    background: linear-gradient(145deg, rgba(232, 131, 58, 0.06), rgba(232, 131, 58, 0.02));
    border: 1px solid rgba(232, 131, 58, 0.12);
  }
  .quad-countries {
    background: linear-gradient(145deg, rgba(232, 127, 168, 0.06), rgba(232, 127, 168, 0.02));
    border: 1px solid rgba(232, 127, 168, 0.12);
  }

  .gender-label {
    color: #4ade80;
  }
  .age-label {
    color: #4d7cff;
  }
  .cities-label {
    color: #e8833a;
  }
  .countries-label {
    color: #e87fa8;
  }

  .section-label {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  /* Donut */
  .donut-wrap {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .donut-svg {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
  .donut-legend {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .legend-label {
    font-family: 'PP Mori', sans-serif;
    font-size: 11px;
    color: #ededef;
    text-transform: capitalize;
  }
  .legend-pct {
    font-family: 'Inter', 'Geist Variable', sans-serif;
    font-size: 14px;
    font-weight: 800;
    color: #ededef;
    letter-spacing: -0.03em;
  }

  /* Horizontal bars */
  .bar-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 60px 1fr 38px;
    align-items: center;
    gap: 8px;
  }
  .bar-label {
    font-family: 'PP Mori', sans-serif;
    font-size: 11px;
    color: rgba(237, 237, 239, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .bar-pct {
    font-family: 'Geist Mono Variable', monospace;
    font-size: 10px;
    font-weight: 400;
    color: #ededef;
    text-align: right;
    letter-spacing: -0.03em;
  }

  @media (max-width: 768px) {
    .demo-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 480px) {
    .demo-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
