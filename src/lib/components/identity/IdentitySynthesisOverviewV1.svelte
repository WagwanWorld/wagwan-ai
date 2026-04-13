<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { IdentitySynthesisCoreIdentity, IdentitySynthesisProfessionRole } from '$lib/types/identitySynthesis';
  import IdentitySynthesisHero from '$lib/components/identity/IdentitySynthesisHero.svelte';
  import IdentitySynthesisProfessionsGrid from '$lib/components/identity/IdentitySynthesisProfessionsGrid.svelte';

  export let core: IdentitySynthesisCoreIdentity;
  export let roles: IdentitySynthesisProfessionRole[];
  export let photoUrl: string | null = null;
  export let musicGalleryUrls: string[] = [];

  const dispatch = createEventDispatcher<{ detail: { title: string; body: string } }>();
</script>

<div class="id-overview">
  <p class="id-overview__kicker">What we know about you</p>
  <IdentitySynthesisHero overviewMode {core} {photoUrl} {musicGalleryUrls} />
  <IdentitySynthesisProfessionsGrid
    embedded
    {roles}
    on:detail={e => dispatch('detail', e.detail)}
  />
</div>

<style>
  .id-overview {
    margin-bottom: 0.25rem;
  }

  .id-overview__kicker {
    margin: 0 0 0.5rem;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--iv-muted, #6b6560);
    text-align: center;
  }
</style>
