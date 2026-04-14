import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import {
  getProfile,
  getTokens,
  getManualInterestTags,
  upsertProfile,
  upsertIdentityGraph,
  insertIdentityInferenceSnapshot,
  isSupabaseConfigured,
} from '$lib/server/supabase';
import {
  mergeNextInference,
  parseInferenceIdentityWrapper,
} from '$lib/server/marketplace/inferenceIdentitySchema';
import { buildRecencyContext } from '$lib/server/marketplace/buildRecencyContext';
import { runIdentityIntelligenceFromInputs } from '$lib/server/marketplace/inferIdentityIntelligence';
import { buildBehavioralPrecalc } from '$lib/server/behavioralPrecalc';
import { projectMemoryGraph } from '$lib/server/memoryGraphProjection';
import { runHyperInferenceFromInputs } from '$lib/server/marketplace/inferHyperInference';
import { runIdentitySnapshotFromInputs } from '$lib/server/marketplace/inferIdentitySnapshot';
import { runIdentitySynthesisFromInputs } from '$lib/server/marketplace/inferIdentitySynthesis';
import { buildInferenceSignalBundle, runInferenceFromBundle } from '$lib/server/marketplace/inferIdentityGraph';
import {
  generateDeveloperToken,
  fetchAppleMusicData,
  analyseAppleMusicIdentity,
  isAppleMusicConfigured,
} from '$lib/server/applemusic';
import { buildIdentityGraph, identitySummary } from '$lib/server/identity';
import type { SignalMeterOutput } from '$lib/types/signalMeter';
import {
  fetchInstagramProfile,
  fetchInstagramMedia,
  expandCarouselChildren,
  analyseInstagramIdentity,
} from '$lib/server/instagram';
import {
  computeInstagramInsightsFromMedia,
  instagramInsightsToGraphTags,
} from '$lib/server/instagramInsights';
import {
  refreshGoogleToken,
  fetchYouTubeData,
  fetchGmailSummary,
  analyseGoogleIdentity,
} from '$lib/server/google';
import { computeGoogleTwinForToken } from '$lib/server/signalProcessor/googleProcessor';
import { fetchSpotifyEnrichedData, analyseSpotifyIdentityEnriched } from '$lib/server/spotify';
import { fetchLinkedInProfile, analyseLinkedInIdentity } from '$lib/server/linkedin';
import { buildSignalMeter } from '$lib/server/signalMeter';
import { syncIdentityClaimsFromGraph } from '$lib/server/identityClaims/syncFromGraph';
import { buildExpressionLayer } from '$lib/server/expression/buildExpressionLayer';
import type { IdentityGraph } from '$lib/server/identity';
import type { ExpressionFeedbackState } from '$lib/types/expressionLayer';

const INFERENCE_THROTTLE_MS = 7 * 86400 * 1000;
/** After 3+ platforms update in one refresh, allow re-inference sooner. */
const LARGE_SYNC_PLATFORM_THRESHOLD = 3;

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: {
    googleSub?: unknown;
    forceInference?: unknown;
    userQuery?: unknown;
    forceIntelligence?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const googleSub = typeof body.googleSub === 'string' ? body.googleSub : '';
  const forceInference = body.forceInference === true;
  const userQuery =
    typeof body.userQuery === 'string' && body.userQuery.trim() ? body.userQuery.trim() : undefined;
  const forceIntelligence = body.forceIntelligence === true;
  if (!googleSub) return json({ ok: false, error: 'missing_google_sub' }, { status: 400 });

  const row = await getProfile(googleSub);
  if (!row) return json({ ok: false, error: 'profile_not_found' }, { status: 404 });

  const tokens = await getTokens(googleSub);
  const profileData = row.profile_data as Record<string, unknown>;
  const expired: string[] = [];
  const updated: Record<string, unknown> = {};

  const tasks: Promise<void>[] = [];

  // Instagram refresh
  if (profileData.instagramConnected && tokens.instagramToken) {
    tasks.push(
      (async () => {
        try {
          const [igProfile, igMediaRaw] = await Promise.all([
            fetchInstagramProfile(tokens.instagramToken!),
            fetchInstagramMedia(tokens.instagramToken!, 40),
          ]);
          const igMedia = await expandCarouselChildren(tokens.instagramToken!, igMediaRaw, 8, 4);
          const identity = await analyseInstagramIdentity(igProfile, igMedia, tokens.instagramToken!);
          const insights = computeInstagramInsightsFromMedia(igProfile, igMediaRaw);
          updated.instagramIdentity = {
            ...identity,
            igInsightsTags: instagramInsightsToGraphTags(insights),
          };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('401') || msg.includes('expired') || msg.includes('Invalid')) {
            expired.push('instagram');
          } else {
            console.error('[RefreshSignals] Instagram error:', msg);
            expired.push('instagram');
          }
        }
      })(),
    );
  }

  // Google refresh
  if (profileData.googleConnected && (tokens.googleRefreshToken || tokens.googleAccessToken)) {
    tasks.push(
      (async () => {
        try {
          let accessToken = tokens.googleAccessToken || '';
          if (tokens.googleRefreshToken) {
            accessToken = await refreshGoogleToken(tokens.googleRefreshToken);
          }
          if (!accessToken) { expired.push('google'); return; }

          const mergeCity = String(
            profileData.city ??
              (profileData.instagramIdentity as { city?: string } | undefined)?.city ??
              '',
          ).trim();

          const [ytData, gmailData, twinData] = await Promise.allSettled([
            fetchYouTubeData(accessToken),
            fetchGmailSummary(accessToken),
            computeGoogleTwinForToken(accessToken, mergeCity || undefined),
          ]);

          const yt = ytData.status === 'fulfilled' ? ytData.value : { channels: [], categories: [] };
          const gmail = gmailData.status === 'fulfilled' ? gmailData.value : { threads: [], senders: [] };
          const twin = twinData.status === 'fulfilled' ? twinData.value : null;

          let email = '', name = '', picture = '';
          try {
            const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (uRes.ok) {
              const u = await uRes.json();
              email = u.email ?? '';
              name = u.name ?? '';
              picture = u.picture ?? '';
            }
          } catch { /* ignore */ }

          const identity = await analyseGoogleIdentity(
            yt.channels, yt.categories,
            gmail.threads, gmail.senders,
            email, name, picture,
            twin?.lifestylePatterns,
          );
          (identity as unknown as Record<string, unknown>).sub = googleSub;
          if (twin) identity.twin = twin;
          updated.googleIdentity = identity;
          updated.googleAccessToken = accessToken;
        } catch (e: unknown) {
          console.error('[RefreshSignals] Google error:', e instanceof Error ? e.message : e);
          expired.push('google');
        }
      })(),
    );
  }

  // Spotify refresh
  if (profileData.spotifyConnected && tokens.spotifyToken) {
    tasks.push(
      (async () => {
        try {
          const enriched = await fetchSpotifyEnrichedData(tokens.spotifyToken!);
          const identity = await analyseSpotifyIdentityEnriched(enriched);
          updated.spotifyIdentity = identity;
        } catch (e: unknown) {
          console.error('[RefreshSignals] Spotify error:', e instanceof Error ? e.message : e);
          expired.push('spotify');
        }
      })(),
    );
  }

  // LinkedIn refresh
  if (profileData.linkedinConnected && tokens.linkedinToken) {
    tasks.push(
      (async () => {
        try {
          const { name, email, headline, industry, country } = await fetchLinkedInProfile(
            tokens.linkedinToken!,
          );
          const identity = await analyseLinkedInIdentity(name, headline, industry, '', country, email);
          updated.linkedinIdentity = identity;
        } catch (e: unknown) {
          console.error('[RefreshSignals] LinkedIn error:', e instanceof Error ? e.message : e);
          expired.push('linkedin');
        }
      })(),
    );
  }

  // Apple Music refresh (requires stored Music-User-Token)
  if (
    profileData.appleMusicConnected &&
    tokens.appleMusicUserToken?.trim() &&
    isAppleMusicConfigured()
  ) {
    tasks.push(
      (async () => {
        try {
          const developerToken = generateDeveloperToken();
          const snap = await fetchAppleMusicData(developerToken, tokens.appleMusicUserToken!);
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
          updated.appleMusicIdentity = identity;
        } catch (e: unknown) {
          console.error('[RefreshSignals] Apple Music error:', e instanceof Error ? e.message : e);
        }
      })(),
    );
  }

  await Promise.allSettled(tasks);

  const manualInterestTags = await getManualInterestTags(googleSub);
  const syncStamp = new Date().toISOString();

  let merged: Record<string, unknown> = {
    ...profileData,
    ...updated,
    manualInterestTags,
  };

  if (Object.keys(updated).length > 0) {
    merged = {
      ...merged,
      signalSyncMeta: {
        ...((profileData.signalSyncMeta as Record<string, string> | undefined) ?? {}),
        ...(updated.spotifyIdentity ? { spotify: syncStamp } : {}),
        ...(updated.appleMusicIdentity ? { apple_music: syncStamp } : {}),
        ...(updated.linkedinIdentity ? { linkedin: syncStamp } : {}),
        ...(updated.googleIdentity ? { google: syncStamp } : {}),
        ...(updated.instagramIdentity ? { instagram: syncStamp } : {}),
      },
      profileUpdatedAt: syncStamp,
    };
    await upsertProfile(googleSub, merged);
  }

  // Recompute and store the identity graph (+ optional LLM inference layer)
  let graphData: Record<string, unknown> | null = null;
  let summaryStr = '';
  let inferenceRevision: number | null = null;
  let inferenceInferredAt: string | null = null;
  let inferenceRan = false;
  let intelligenceRan = false;
  let intelligenceGeneratedAt: string | null = null;
  let snapshotRan = false;
  let hyperInferenceRan = false;
  let hyperInferenceGeneratedAt: string | null = null;
  try {
    const signalMeter = buildSignalMeter(merged);
    const graph = buildIdentityGraph({ ...merged, signalMeter });
    const behavioralPrecalc = buildBehavioralPrecalc(graph, signalMeter, merged);
    summaryStr = identitySummary(graph);
    const base = graph as unknown as Record<string, unknown>;
    const priorFullGraph = (row.identity_graph ?? {}) as Record<string, unknown>;
    const priorWrap = parseInferenceIdentityWrapper(priorFullGraph.inferenceIdentity);

    const keyOk = Boolean((env.ANTHROPIC_API_KEY ?? '').trim());
    const meaningfulPlatformSync = Object.keys(updated).length > 0;
    const largePlatformSync = Object.keys(updated).length >= LARGE_SYNC_PLATFORM_THRESHOLD;
    const effectiveThrottleMs = largePlatformSync
      ? Math.floor(INFERENCE_THROTTLE_MS / 3)
      : INFERENCE_THROTTLE_MS;
    const inferredMs = priorWrap ? Date.parse(priorWrap.inferredAt) : NaN;
    const recent =
      priorWrap &&
      Number.isFinite(inferredMs) &&
      Date.now() - inferredMs < effectiveThrottleMs;
    const shouldInfer = keyOk && (forceInference || meaningfulPlatformSync || !priorWrap || !recent);

    let inferenceIdentity: unknown = priorFullGraph.inferenceIdentity;

    if (shouldInfer) {
      inferenceRan = true;
      const bundle = buildInferenceSignalBundle(
        merged,
        graph,
        summaryStr,
        priorWrap?.current ?? null,
        {
          meaningfulPlatformSync,
          updatedPlatforms: Object.keys(updated),
        },
        behavioralPrecalc,
      );
      const current = await runInferenceFromBundle(bundle);
      if (current) {
        const next = mergeNextInference(priorWrap, current);
        inferenceIdentity = next;
        inferenceRevision = next.revision;
        inferenceInferredAt = next.inferredAt;
        await insertIdentityInferenceSnapshot(
          googleSub,
          next.revision,
          next as unknown as Record<string, unknown>,
        );
      }
    }

    graphData = { ...base };
    if (inferenceIdentity !== undefined && inferenceIdentity !== null) {
      graphData.inferenceIdentity = inferenceIdentity;
    }
    if (!shouldInfer && priorWrap) {
      inferenceRevision = priorWrap.revision;
      inferenceInferredAt = priorWrap.inferredAt;
    }

    const inferenceWrapForIntel = parseInferenceIdentityWrapper(graphData.inferenceIdentity);
    const inferenceCurrentForIntel = inferenceWrapForIntel?.current ?? null;
    const shouldRunIntelligence =
      keyOk && (shouldInfer || Boolean(userQuery) || forceIntelligence);

    if (priorFullGraph.identityIntelligence !== undefined && priorFullGraph.identityIntelligence !== null) {
      graphData.identityIntelligence = priorFullGraph.identityIntelligence;
    }
    if (priorFullGraph.identitySnapshot !== undefined && priorFullGraph.identitySnapshot !== null) {
      graphData.identitySnapshot = priorFullGraph.identitySnapshot;
    }
    if (priorFullGraph.hyperInference !== undefined && priorFullGraph.hyperInference !== null) {
      graphData.hyperInference = priorFullGraph.hyperInference;
    }

    if (shouldRunIntelligence) {
      const recency = buildRecencyContext({
        profileData: merged as Record<string, unknown>,
        updatedPlatformKeys: Object.keys(updated),
      });
      const [intel, snap, hyper] = await Promise.allSettled([
        runIdentityIntelligenceFromInputs({
          graph,
          identitySummary: summaryStr,
          inferenceCurrent: inferenceCurrentForIntel,
          recencyContext: recency,
          userQuery,
        }),
        runIdentitySnapshotFromInputs({
          graph,
          identitySummary: summaryStr,
          inferenceCurrent: inferenceCurrentForIntel,
          recencyContext: recency,
        }),
        runHyperInferenceFromInputs({
          graph,
          signalMeter,
          identitySummary: summaryStr,
          recencyContext: recency,
          mergedProfile: merged as Record<string, unknown>,
          behavioralPrecalc,
        }),
      ]);
      if (intel.status === 'fulfilled' && intel.value) {
        graphData.identityIntelligence = intel.value;
        intelligenceRan = true;
        intelligenceGeneratedAt = intel.value.generatedAt;
      }
      if (snap.status === 'fulfilled' && snap.value) {
        graphData.identitySnapshot = snap.value;
        snapshotRan = true;
      }
      if (hyper.status === 'fulfilled' && hyper.value) {
        graphData.hyperInference = hyper.value;
        hyperInferenceRan = true;
        hyperInferenceGeneratedAt = hyper.value.generatedAt;
      }
    }

    graphData.memoryGraph = projectMemoryGraph({
      precalc: behavioralPrecalc,
      signalMeter,
      inferenceIdentity: graphData.inferenceIdentity,
      hyperInference: graphData.hyperInference,
    });

    if (keyOk && shouldRunIntelligence) {
      const recencyForSynth = buildRecencyContext({
        profileData: merged as Record<string, unknown>,
        updatedPlatformKeys: Object.keys(updated),
      });
      try {
        const synthesis = await runIdentitySynthesisFromInputs({
          graph,
          identitySummary: summaryStr,
          inferenceCurrent: inferenceCurrentForIntel,
          recencyContext: recencyForSynth,
          identitySnapshot: graphData.identitySnapshot ?? null,
          identityIntelligence: graphData.identityIntelligence ?? null,
          hyperInference: graphData.hyperInference ?? null,
          signalMeter: (graphData.signalMeter as SignalMeterOutput | undefined) ?? signalMeter,
          memoryGraph: graphData.memoryGraph ?? null,
          userQuery,
        });
        if (synthesis) {
          graphData.identitySynthesis = synthesis as unknown as Record<string, unknown>;
        } else if (priorFullGraph.identitySynthesis != null) {
          graphData.identitySynthesis = priorFullGraph.identitySynthesis as Record<string, unknown>;
        }
      } catch (e) {
        console.error('[RefreshSignals] identitySynthesis:', e instanceof Error ? e.message : e);
        if (priorFullGraph.identitySynthesis != null) {
          graphData.identitySynthesis = priorFullGraph.identitySynthesis as Record<string, unknown>;
        }
      }
    }

    const priorExprFeedback = priorFullGraph.expressionFeedback as ExpressionFeedbackState | undefined;
    if (keyOk) {
      try {
        const graphForExpression: IdentityGraph = {
          ...graph,
          inferenceIdentity: graphData.inferenceIdentity as IdentityGraph['inferenceIdentity'],
          hyperInference: graphData.hyperInference as IdentityGraph['hyperInference'],
        };
        const exprLayer = await buildExpressionLayer({
          mergedProfile: merged,
          graph: graphForExpression,
          identitySummary: summaryStr,
          signalMeter,
          feedback: priorExprFeedback,
        });
        graphData.expressionLayer = exprLayer as unknown as Record<string, unknown>;
      } catch (e) {
        console.error('[RefreshSignals] expressionLayer:', e instanceof Error ? e.message : e);
        if (priorFullGraph.expressionLayer) {
          graphData.expressionLayer = priorFullGraph.expressionLayer as Record<string, unknown>;
        }
      }
    } else if (priorFullGraph.expressionLayer) {
      graphData.expressionLayer = priorFullGraph.expressionLayer as Record<string, unknown>;
    }
    graphData.expressionFeedback = priorExprFeedback ?? { votes: [], atomNudges: {} };

    await upsertIdentityGraph(googleSub, graphData, summaryStr);
    await syncIdentityClaimsFromGraph(googleSub, graph, graphData.inferenceIdentity);
  } catch (e) {
    console.error('[RefreshSignals] Identity graph build error:', e);
  }

  return json({
    ok: true,
    updated,
    expired,
    identityGraph: graphData,
    identitySummary: summaryStr,
    updatedAt: new Date().toISOString(),
    inferenceRan,
    inferenceRevision,
    inferenceInferredAt,
    intelligenceRan,
    intelligenceGeneratedAt,
    snapshotRan,
    hyperInferenceRan,
    hyperInferenceGeneratedAt,
  });
};
