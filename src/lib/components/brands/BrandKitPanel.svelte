<script lang="ts">
  import OsCard from '$lib/components/os/OsCard.svelte';
  import OsButton from '$lib/components/os/OsButton.svelte';
  import BrandKitSection from './BrandKitSection.svelte';
  import type { BrandOsDashboard } from '$lib/types/brand-os';

  export let brandKit: BrandOsDashboard['brandKit'];
  export let syncing = false;
  export let onRegenerate: () => void;
</script>

<OsCard className="os-bento-span-12 brand-kit-panel">
  <header>
    <div>
      <p class="kicker">AI Brand Kit</p>
      <h2>Single source of brand direction</h2>
    </div>
    <OsButton on:click={onRegenerate} disabled={syncing}>Regenerate Brand Kit</OsButton>
  </header>

  <div class="grid">
    <BrandKitSection title="Messaging Pillars" items={brandKit.messagingPillars} />
    <BrandKitSection
      title="Visual Direction"
      items={[
        `Palette: ${brandKit.visualDirection.palette}`,
        `Mood: ${brandKit.visualDirection.mood}`,
        `Composition: ${brandKit.visualDirection.composition}`,
        ...brandKit.visualDirection.doDonts,
      ]}
    />
    <BrandKitSection title="Campaign Rules" items={brandKit.campaignRules} />
    <BrandKitSection
      title="Audience Personas"
      items={brandKit.audiencePersonas.map((p) => `${p.name}: ${p.description}`)}
    />
    <BrandKitSection
      title="7-Day Content Calendar"
      items={brandKit.contentCalendar.map((d) => `${d.day} ${d.slot} · ${d.pillar} · ${d.concept}`)}
    />
  </div>
</OsCard>

<style>
  .brand-kit-panel {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .kicker {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  h2 {
    margin: 4px 0 0;
    font-size: 1rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  @media (max-width: 1200px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }
    header {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
