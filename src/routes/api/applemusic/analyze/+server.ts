/**
 * Receives a MusicKit user token from the client,
 * fetches library data, runs Claude analysis, and returns AppleMusicIdentity.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  generateDeveloperToken,
  fetchAppleMusicData,
  analyseAppleMusicIdentity,
  isAppleMusicConfigured,
} from '$lib/server/applemusic';

export const POST: RequestHandler = async ({ request }) => {
  if (!isAppleMusicConfigured()) {
    throw error(503, 'Apple Music not configured');
  }

  let body: { userToken: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  if (!body.userToken) throw error(400, 'userToken is required');

  try {
    const developerToken = generateDeveloperToken();
    const snap = await fetchAppleMusicData(developerToken, body.userToken);
    const identity = await analyseAppleMusicIdentity(
      snap.artists,
      snap.albums,
      snap.genres,
      snap.rotationPlaylists,
      snap.libraryPlaylistNames,
      snap.latestReleases,
      snap.heavyRotationTracks,
      snap.recentlyPlayed,
      snap.libraryArtists,
      snap.lovedSongs,
      snap.recommendedNames,
      snap.storefront,
      snap.artworkMap,
      snap.genreFrequency,
      snap.durationStats,
      snap.releaseYearDist,
    );
    return json(identity);
  } catch (e) {
    console.error('Apple Music analysis error:', e);
    throw error(500, 'Apple Music analysis failed');
  }
};
