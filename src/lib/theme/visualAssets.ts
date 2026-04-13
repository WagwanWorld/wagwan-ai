/**
 * Curated imagery slots for empty states, onboarding, and marketing heroes.
 * Swap URLs here (or point to /static/theme/*) without hunting the UI.
 */
import { suggestionHeroUrl } from '$lib/suggestionImagery';

export const visualAssets = {
  empty: {
    feed: {
      src: suggestionHeroUrl('experience', 560, 360),
      alt: 'Evening city scene suggesting things to discover',
      aspect: '16/10' as const,
    },
  },
  explore: {
    hero: {
      src: suggestionHeroUrl('travel', 900, 500),
      alt: 'Landscape suggesting exploration',
      aspect: '16/9' as const,
    },
  },
  onboarding: {
    welcome: {
      src: suggestionHeroUrl('culture', 800, 600),
      alt: 'Live music and social energy',
      aspect: '4/3' as const,
    },
  },
} as const;

export type VisualAssetKey = keyof typeof visualAssets;
