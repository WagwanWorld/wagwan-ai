<!--
  Apple Music connect page.
  Loads MusicKit JS, then user taps to authorize (required user gesture for Apple's auth UI),
  then POSTs the user token to /api/applemusic/analyze.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { profile } from '$lib/stores/profile';
  import { syncProfileToSupabase } from '$lib/client/syncProfileToSupabase';
  import type { AppleMusicIdentity } from '$lib/utils';

  let status: 'loading' | 'ready' | 'connecting' | 'analyzing' | 'done' | 'error' = 'loading';
  let errorMsg = '';
  /** Set on mount so the error UI can return to onboarding vs profile */
  let fromOnboardingFlow = false;
  let developerToken = '';
  let connectInFlight = false;

  onMount(async () => {
    fromOnboardingFlow = $page.url.searchParams.get('from') === 'onboarding';
    try {
      const res = await fetch('/auth/applemusic/developer-token');
      if (!res.ok) {
        if (res.status === 503) {
          errorMsg = 'Apple Music is not configured yet. Add your Apple Developer keys to .env.';
        } else {
          errorMsg = 'Could not generate Apple Music token — check that APPLE_PRIVATE_KEY in .env is the full .p8 file (with -----BEGIN PRIVATE KEY----- header, or the raw base64 body).';
        }
        status = 'error';
        return;
      }
      const data = await res.json();
      developerToken = data.token;
    } catch {
      errorMsg = 'Could not reach server.';
      status = 'error';
      return;
    }

    await new Promise<void>((resolve, reject) => {
      if ((window as unknown as Record<string, unknown>)['MusicKit']) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load MusicKit JS'));
      document.head.appendChild(script);
    }).catch(() => {
      errorMsg = 'Failed to load MusicKit JS. Check your connection.';
      status = 'error';
    });

    if (status !== 'error') status = 'ready';
  });

  async function connectAppleMusic() {
    if (connectInFlight || !developerToken) return;
    connectInFlight = true;
    const fromOnboarding = fromOnboardingFlow;
    status = 'connecting';
    try {
      const MusicKit = (
        window as unknown as {
          MusicKit: {
            configure: (config: Record<string, unknown>) => Promise<{
              authorize: () => Promise<string>;
              musicUserToken: string;
            }>;
          };
        }
      ).MusicKit;
      const music = await MusicKit.configure({
        developerToken,
        app: { name: 'Wagwan AI', build: '1.0' },
      });
      const userToken = (await music.authorize()) || music.musicUserToken;
      if (!userToken) throw new Error('No user token returned from Apple Music');

      status = 'analyzing';
      const res = await fetch('/api/applemusic/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userToken }),
      });

      if (!res.ok) {
        let detail = `Analysis failed (${res.status})`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) detail = j.message;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      const identity: AppleMusicIdentity = await res.json();

      if (fromOnboarding) {
        try {
          localStorage.setItem('onboarding_apple_music', JSON.stringify(identity));
        } catch {
          /* ignore */
        }
      } else {
        profile.update(p => ({ ...p, appleMusicConnected: true, appleMusicIdentity: identity }));
        if (get(profile).googleSub) {
          await syncProfileToSupabase(get(profile), { appleMusicUserToken: userToken });
        }
      }
      status = 'done';
      setTimeout(
        () => goto(fromOnboarding ? '/onboarding?apple=connected' : '/profile?apple=connected'),
        1000,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('cancel') || msg.includes('abort')) {
        status = 'ready';
      } else {
        errorMsg =
          msg.length && msg !== 'Error'
            ? msg
            : 'Something went wrong during Apple Music authorization. Try Safari, HTTPS, or confirm your Apple Developer MusicKit key and MusicKit Identifier.';
        status = 'error';
      }
    } finally {
      connectInFlight = false;
    }
  }
</script>

<div style="min-height:100svh;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;">
  {#if status === 'loading' || status === 'ready'}
  <div style="font-size:48px;margin-bottom:16px;">🎵</div>
  <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Connect Apple Music</div>
  <div style="font-size:14px;color:var(--text2);margin-bottom:24px;line-height:1.6;">
    Authorise Wagwan AI to read your listening history.<br>We use it for your identity graph and audience matching. If you are signed in, your Music User Token may be stored so refresh can update taste signals. Disconnect anytime in Profile.
  </div>
  {#if status === 'ready'}
  <button
    type="button"
    on:click={connectAppleMusic}
    disabled={connectInFlight}
    style="font-size:15px;font-weight:600;color:var(--text);background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);padding:14px 28px;border-radius:100px;cursor:pointer;"
  >Sign in with Apple Music</button>
  <div style="font-size:12px;color:var(--text3);margin-top:16px;max-width:320px;">
    Use a normal browser window (not an in-app browser). An active Apple&nbsp;Music subscription is required for full library access.
  </div>
  {:else}
  <div style="display:flex;gap:5px;justify-content:center;">
    {#each [0.1, 0.3, 0.5] as d}
    <div style="width:8px;height:8px;border-radius:50%;background:var(--accent);animation:bounce 0.9s {d}s infinite;"></div>
    {/each}
  </div>
  {/if}

  {:else if status === 'connecting'}
  <div style="font-size:48px;margin-bottom:16px;">🔐</div>
  <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Authorizing...</div>
  <div style="font-size:13px;color:var(--text2);">Complete the Apple Music sign-in</div>

  {:else if status === 'analyzing'}
  <div style="font-size:48px;margin-bottom:16px;">✦</div>
  <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Reading your music taste...</div>
  <div style="font-size:13px;color:var(--text2);">Claude is analysing your library</div>
  <div style="display:flex;gap:5px;justify-content:center;margin-top:16px;">
    {#each [0.1, 0.3, 0.5] as d}
    <div style="width:8px;height:8px;border-radius:50%;background:var(--accent);animation:bounce 0.9s {d}s infinite;"></div>
    {/each}
  </div>

  {:else if status === 'done'}
  <div style="font-size:48px;margin-bottom:16px;">✅</div>
  <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Apple Music connected!</div>
  <div style="font-size:13px;color:var(--text2);">Redirecting…</div>

  {:else if status === 'error'}
  <div style="font-size:48px;margin-bottom:16px;">⚡</div>
  <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Connection failed</div>
  <div style="font-size:13px;color:var(--text2);margin-bottom:24px;line-height:1.5;">{errorMsg}</div>
  <button
    type="button"
    on:click={() => goto(fromOnboardingFlow ? '/onboarding' : '/profile')}
    style="font-size:14px;font-weight:600;color:var(--text);background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);padding:12px 24px;border-radius:100px;cursor:pointer;"
  >← Back</button>
  {/if}
</div>
