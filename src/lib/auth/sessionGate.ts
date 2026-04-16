import { goto } from '$app/navigation';
import { profile } from '$lib/stores/profile';
import type { UserProfile } from '$lib/stores/profile';
import { primaryAccountKey } from './accountKey';

export function isAppSessionValid(p: UserProfile): boolean {
  if (!p.setupComplete) return false;
  const hasGoogle = p.googleConnected && !!p.googleIdentity?.sub;
  const hasIg = p.instagramConnected && !!p.instagramIdentity;
  if (!hasGoogle && !hasIg) return false;
  return !!primaryAccountKey(p).trim();
}

/** When legacy clients have IG finished but empty `googleSub`, derive `ig:…` and persist. */
export function maybeRepairIgOnlyAccountKey(p: UserProfile): UserProfile | null {
  if (!p.setupComplete || !p.instagramConnected || !p.instagramIdentity) return null;
  if (p.googleSub?.trim()) return null;
  const id = p.instagramIdentity.igUserId?.trim();
  const u = p.instagramIdentity.username?.trim();
  const key = id ? `ig:${id}` : u ? `ig:user:${u.toLowerCase()}` : '';
  if (!key) return null;
  return { ...p, googleSub: key };
}

/** Clear local session and send user through onboarding again. Does not delete Supabase rows. */
export function invalidateAndGoToOnboarding(): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (
        k.startsWith('onboarding_') ||
        k.startsWith('wagwan_home_') ||
        k.startsWith('wagwan_google_')
      ) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
  profile.reset();
  void goto('/', { replaceState: true });
}
