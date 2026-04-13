/**
 * Identity-driven quick prompts for Home PA bar and /ai chips.
 * Dynamically generated from the user's identity signals.
 */
import { quickAskImage, suggestionHeroUrl } from '$lib/suggestionImagery';

export interface TwinStarter {
  label: string;
  img: string;
  query: string;
}

interface StarterProfile {
  city?: string;
  interests?: string[];
  instagramIdentity?: {
    foodVibe?: string;
    musicVibe?: string;
    aesthetic?: string;
    travelStyle?: string;
    visual?: {
      cuisineTypes?: string[];
      locationTypes?: string[];
    };
    temporal?: {
      activityPattern?: string;
      peakDays?: string[];
    };
    engagement?: {
      socialVisibility?: string;
    };
  } | null;
  spotifyIdentity?: {
    topArtists?: string[];
    topGenres?: string[];
  } | null;
}

export function buildTwinStarters(city: string, profile?: StarterProfile): TwinStarter[] {
  const c = city || 'my city';
  const ig = profile?.instagramIdentity;
  const sp = profile?.spotifyIdentity;

  const topInterest = profile?.interests?.[0] ?? '';
  const foodVibe = ig?.foodVibe ?? '';
  const musicVibe = ig?.musicVibe ?? '';
  const topArtist = sp?.topArtists?.[0] ?? '';
  const travelStyle = ig?.travelStyle ?? '';
  const visualCuisine = ig?.visual?.cuisineTypes?.[0] ?? '';
  const visualLocation = ig?.visual?.locationTypes?.[0] ?? '';
  const peakDay = ig?.temporal?.peakDays?.[0] ?? '';

  const starters: TwinStarter[] = [
    {
      label: 'Plan my Saturday',
      img: quickAskImage.tonight,
      query: 'Plan my Saturday with concrete steps and timings',
    },
    {
      label: 'Summarise today',
      img: quickAskImage.tonight,
      query: 'Summarise what matters for me today across inbox, calendar, and vibe',
    },
  ];

  if (topArtist) {
    starters.push({
      label: `New from ${topArtist.split(' ')[0]}`,
      img: quickAskImage.music,
      query: `new music from ${topArtist} or similar artists I'd love`,
    });
  } else if (musicVibe) {
    starters.push({
      label: 'Music for my vibe',
      img: quickAskImage.music,
      query: `new ${musicVibe} music I would love right now`,
    });
  } else {
    starters.push({
      label: 'Music for my vibe',
      img: quickAskImage.music,
      query: 'new music I would love right now',
    });
  }

  if (visualCuisine || foodVibe) {
    const hint = visualCuisine || foodVibe.split(',')[0]?.trim() || 'food';
    starters.push({
      label: `Best ${hint.split(' ')[0]}`,
      img: quickAskImage.food,
      query: `best ${hint} restaurant or cafe in ${c} matching my taste`,
    });
  } else {
    starters.push({
      label: 'Where to eat',
      img: quickAskImage.food,
      query: `best restaurant or cafe matching my taste in ${c}`,
    });
  }

  starters.push({
    label: 'Tonight',
    img: quickAskImage.tonight,
    query: `what's on tonight in ${c}`,
  });

  if (travelStyle || visualLocation) {
    const hint = travelStyle || visualLocation;
    starters.push({
      label: 'Weekend trip',
      img: quickAskImage.trip,
      query: `best ${hint} weekend trip from ${c}`,
    });
  } else {
    starters.push({
      label: 'Weekend trip',
      img: quickAskImage.trip,
      query: `best weekend trip from ${c}`,
    });
  }

  starters.push({
    label: 'Draft a message',
    img: suggestionHeroUrl('fashion', 96, 96),
    query: 'Help me draft a short message I can send',
  });

  return starters.slice(0, 7);
}
