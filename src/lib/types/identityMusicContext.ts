import type { AppleMusicLatestRelease } from '$lib/utils';

/** Slim music context from profile for identity synthesis imagery (Apple-first artists on home). */
export type IdentityMusicContext = {
  topArtists: string[];
  topAlbums?: string[];
  latestReleases?: AppleMusicLatestRelease[];
};
