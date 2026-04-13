import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

let _client: SupabaseClient | null = null;

/** Shared service-role client for chats, agent tables, and user_profiles. */
export function getServiceSupabase(): SupabaseClient {
  return getClient();
}

function getClient(): SupabaseClient {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return _client;
}

export interface UserProfileRow {
  google_sub: string;
  email: string | null;
  name: string | null;
  profile_data: Record<string, unknown>;
  platform_tokens: PlatformTokens;
  identity_graph: Record<string, unknown>;
  identity_summary: string;
  updated_at: string;
}

export interface PlatformTokens {
  instagramToken?: string;
  spotifyToken?: string;
  linkedinToken?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  /** Apple Music Music-User-Token for server-side refresh (optional; stored when user connects). */
  appleMusicUserToken?: string;
}

export async function getProfile(googleSub: string): Promise<UserProfileRow | null> {
  const { data, error } = await getClient()
    .from('user_profiles')
    .select('*')
    .eq('google_sub', googleSub)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] getProfile error:', error.message);
  }
  return data ?? null;
}

export async function upsertProfile(
  googleSub: string,
  profileData: Record<string, unknown>,
  tokens?: Partial<PlatformTokens>,
  email?: string,
  name?: string,
): Promise<boolean> {
  const existing = await getProfile(googleSub);
  const mergedProfile = {
    ...(existing?.profile_data ?? {}),
    ...profileData,
  };

  const row: Record<string, unknown> = {
    google_sub: googleSub,
    profile_data: mergedProfile,
    updated_at: new Date().toISOString(),
  };
  if (email !== undefined) row.email = email;
  if (name !== undefined) row.name = name;

  if (tokens && Object.keys(tokens).length > 0) {
    const existing = await getTokens(googleSub);
    row.platform_tokens = { ...existing, ...tokens };
  }

  const { error } = await getClient()
    .from('user_profiles')
    .upsert(row, { onConflict: 'google_sub' });

  if (error) {
    console.error('[Supabase] upsertProfile error:', error.message);
    return false;
  }
  return true;
}

export async function getManualInterestTags(googleSub: string): Promise<string[]> {
  const { data, error } = await getClient()
    .from('user_marketing_prefs')
    .select('manual_interest_tags')
    .eq('user_google_sub', googleSub)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] getManualInterestTags error:', error.message);
  }
  const raw = data?.manual_interest_tags;
  return Array.isArray(raw) ? (raw as string[]).map(s => String(s).trim()).filter(Boolean) : [];
}

export async function getTokens(googleSub: string): Promise<PlatformTokens> {
  const { data, error } = await getClient()
    .from('user_profiles')
    .select('platform_tokens')
    .eq('google_sub', googleSub)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] getTokens error:', error.message);
  }
  return (data?.platform_tokens as PlatformTokens) ?? {};
}

export async function updateProfileData(
  googleSub: string,
  partialData: Record<string, unknown>,
): Promise<boolean> {
  const existing = await getProfile(googleSub);
  if (!existing) return false;

  const merged = { ...existing.profile_data, ...partialData };
  const { error } = await getClient()
    .from('user_profiles')
    .update({ profile_data: merged, updated_at: new Date().toISOString() })
    .eq('google_sub', googleSub);

  if (error) {
    console.error('[Supabase] updateProfileData error:', error.message);
    return false;
  }
  return true;
}

export async function updateTokens(
  googleSub: string,
  tokens: Partial<PlatformTokens>,
): Promise<boolean> {
  const existing = await getTokens(googleSub);
  const merged = { ...existing, ...tokens };
  const { error } = await getClient()
    .from('user_profiles')
    .update({ platform_tokens: merged, updated_at: new Date().toISOString() })
    .eq('google_sub', googleSub);

  if (error) {
    console.error('[Supabase] updateTokens error:', error.message);
    return false;
  }
  return true;
}

export async function upsertIdentityGraph(
  googleSub: string,
  graph: Record<string, unknown>,
  summary: string,
): Promise<boolean> {
  const { error } = await getClient()
    .from('user_profiles')
    .update({
      identity_graph: graph,
      identity_summary: summary,
      updated_at: new Date().toISOString(),
    })
    .eq('google_sub', googleSub);

  if (error) {
    console.error('[Supabase] upsertIdentityGraph error:', error.message);
    return false;
  }
  return true;
}

/** Append-only audit row for identity inference evolution (service role). */
export async function insertIdentityInferenceSnapshot(
  googleSub: string,
  revision: number,
  payload: Record<string, unknown>,
  source = 'refresh-signals',
): Promise<boolean> {
  const { error } = await getClient().from('user_identity_inference_snapshots').insert({
    user_google_sub: googleSub,
    revision,
    source,
    payload,
  });

  if (error) {
    console.error('[Supabase] insertIdentityInferenceSnapshot error:', error.message);
    return false;
  }
  return true;
}

/** Raw `identity_graph` JSON only — for merging persisted inference layers onto a client-built graph. */
export async function getIdentityGraphBlob(
  googleSub: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await getClient()
    .from('user_profiles')
    .select('identity_graph')
    .eq('google_sub', googleSub)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] getIdentityGraphBlob error:', error.message);
  }
  if (!data?.identity_graph || typeof data.identity_graph !== 'object') return null;
  return data.identity_graph as Record<string, unknown>;
}

export async function getIdentityGraph(
  googleSub: string,
): Promise<{ graph: Record<string, unknown>; summary: string } | null> {
  const { data, error } = await getClient()
    .from('user_profiles')
    .select('identity_graph, identity_summary')
    .eq('google_sub', googleSub)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] getIdentityGraph error:', error.message);
  }
  if (!data) return null;

  const graph = (data.identity_graph as Record<string, unknown>) ?? {};
  const summary = (data.identity_summary as string) ?? '';
  if (!summary || Object.keys(graph).length === 0) return null;

  return { graph, summary };
}

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}
