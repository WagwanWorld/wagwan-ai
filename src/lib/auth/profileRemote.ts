import type { UserProfile } from '$lib/stores/profile';

/** Load cloud profile for merge after OAuth or repair. */
export async function fetchCloudProfile(accountSub: string): Promise<{
  profile: Partial<UserProfile>;
  updatedAt: string;
} | null> {
  try {
    const r = await fetch(`/api/profile/load?sub=${encodeURIComponent(accountSub)}`);
    if (!r.ok) return null;
    const data = await r.json();
    if (!data?.ok || !data.profile) return null;
    return {
      profile: data.profile as Partial<UserProfile>,
      updatedAt: data.updatedAt as string,
    };
  } catch {
    return null;
  }
}
