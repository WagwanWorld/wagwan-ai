/**
 * MusicKit JS: play catalog / library items saved in AppleMusicTrackHint.
 * Loads https://js-cdn.music.apple.com/musickit/v3/musickit.js when needed.
 */
import type { AppleMusicTrackHint } from '$lib/utils';

type MkMusic = {
  musicUserToken?: string;
  developerToken?: string;
  authorize: () => Promise<string>;
  setQueue: (opts: { song?: string; songs?: string[]; album?: string }) => Promise<unknown>;
  play: () => Promise<unknown>;
};

type MusicKitStatic = {
  configure: (opts: {
    developerToken: string;
    app: { name: string; build: string };
  }) => Promise<MkMusic>;
  getInstance?: () => MkMusic | undefined;
};

function loadMusicKitScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  const w = window as Window & { MusicKit?: MusicKitStatic };
  if (w.MusicKit) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('MusicKit script failed'));
    document.head.appendChild(script);
  });
}

async function getAppleMusicKit(): Promise<MkMusic> {
  await loadMusicKitScript();
  const MK = (window as Window & { MusicKit?: MusicKitStatic }).MusicKit;
  if (!MK) throw new Error('MusicKit missing');
  const res = await fetch('/auth/applemusic/developer-token');
  if (!res.ok) throw new Error('Developer token unavailable');
  const { token } = (await res.json()) as { token?: string };
  if (!token) throw new Error('No token');
  const existing = MK.getInstance?.();
  if (existing) return existing;
  return MK.configure({
    developerToken: token,
    app: { name: 'Wagwan AI', build: '1.0' },
  });
}

export function appleMusicFallbackSearchUrl(hint: AppleMusicTrackHint, storefront = 'us'): string {
  const t = [hint.title, hint.artistName].filter(Boolean).join(' ');
  return `https://music.apple.com/${storefront}/search?term=${encodeURIComponent(t)}`;
}

function openFallback(hint: AppleMusicTrackHint, storefront: string): void {
  const u = hint.playUrl || appleMusicFallbackSearchUrl(hint, storefront);
  window.open(u, '_blank', 'noopener,noreferrer');
}

/** Tries in-app playback; on failure or missing id opens Apple Music in a new tab. */
export async function playAppleMusicTrack(hint: AppleMusicTrackHint, storefront = 'us'): Promise<void> {
  if (!hint.appleMusicId) {
    openFallback(hint, storefront);
    return;
  }
  try {
    const music = await getAppleMusicKit();
    if (!music.musicUserToken) {
      await music.authorize();
    }
    const id = hint.appleMusicId;
    if (id.startsWith('i.')) {
      await music.setQueue({ songs: [id] });
    } else if (hint.playAs === 'album') {
      await music.setQueue({ album: id });
    } else {
      await music.setQueue({ song: id });
    }
    await music.play();
  } catch {
    openFallback(hint, storefront);
  }
}
