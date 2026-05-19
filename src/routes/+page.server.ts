import type { PageServerLoad } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

export const load: PageServerLoad = async () => {
  try {
    if (!isSupabaseConfigured()) return { creators: [] };

    const sb = getServiceSupabase();
    const { data: rows, error } = await sb
      .from('user_profiles')
      .select('name, profile_data, identity_graph')
      .limit(30);

    if (error || !rows) return { creators: [] };

    const creators = rows
      .map((row) => {
        const profileData = (row.profile_data ?? {}) as Record<string, unknown>;
        const graph = (row.identity_graph ?? {}) as Record<string, unknown>;
        const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;

        return {
          name: (row.name as string) || '',
          handle: (ig?.username as string) || '',
          profilePicture: (ig?.profilePicture as string) || '',
          followers: (ig?.followersCount as number) || 0,
          city: (graph.city as string) || (profileData.city as string) || '',
          aesthetic: (graph.aesthetic as string) || (ig?.aesthetic as string) || '',
          archetype: (graph as any).identitySnapshot?.payload?.archetype || '',
          categories: ((graph.contentCategories || []) as string[]).slice(0, 2),
        };
      })
      .filter((c) => c.name && c.profilePicture);

    return { creators: creators.slice(0, 12) };
  } catch {
    return { creators: [] };
  }
};
