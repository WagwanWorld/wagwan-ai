import { env } from '$env/dynamic/private';
import Anthropic from '@anthropic-ai/sdk';

export interface CreativeContext {
  visual_identity: {
    dominant_colors: { hex: string; role: string }[];
    type_style: string;
    composition_patterns: string;
    image_treatment: string;
    whitespace_density: string;
    recurring_motifs: string[];
  };
  voice_profile: {
    sentence_length: string;
    formality: string;
    hooks_reused: string[];
    words_avoided: string[];
  };
  learned_preferences: {
    revision_patterns_summary: string;
    preferred_formats: Record<string, number>;
    approval_rate: number;
  };
  last_refreshed: string;
  context_version: number;
}

const supaHeaders = () => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

/** Read creative_context from brand_accounts. If empty, build it. */
export async function getOrBuildCreativeContext(brandIgId: string): Promise<CreativeContext> {
  const supabaseUrl = env.SUPABASE_URL!;

  // Read existing context
  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}&select=creative_context,brand_identity,brand_voice&limit=1`,
    { headers: supaHeaders() },
  );
  const rows = await res.json();
  const brand = rows[0];
  if (!brand) throw new Error('Brand not found');

  const existing = brand.creative_context as CreativeContext | null;
  if (existing && existing.context_version) return existing;

  // Build from scratch
  return buildCreativeContext(brandIgId, brand);
}

async function buildCreativeContext(
  brandIgId: string,
  brand: Record<string, unknown>,
): Promise<CreativeContext> {
  const supabaseUrl = env.SUPABASE_URL!;

  // Fetch brand kit from snapshot
  const snapRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${brandIgId}&select=intelligence&order=created_at.desc&limit=1`,
    { headers: supaHeaders() },
  );
  const snapRows = snapRes.ok ? await snapRes.json() : [];
  const intelligence = snapRows[0]?.intelligence || {};

  // Fetch fingerprints for style analysis
  const fpRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_fingerprints?brand_ig_id=eq.${brandIgId}&order=posted_at.desc&limit=10&select=caption,hashtags,hook_archetype,engagement_score`,
    { headers: supaHeaders() },
  );
  const fingerprints = fpRes.ok ? await fpRes.json() : [];

  const identity = (brand.brand_identity || {}) as Record<string, string>;
  const brandVoice = (brand.brand_voice || 'Bold') as string;

  // Use Haiku to summarize into creative context
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  const summary = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Analyze this brand's creative identity and return a JSON object.

Brand voice: ${brandVoice}
Identity: ${JSON.stringify(identity).slice(0, 500)}
Content pillars: ${JSON.stringify(intelligence.contentPillars || []).slice(0, 300)}
Audience: ${JSON.stringify(intelligence.audiencePersonas || []).slice(0, 300)}
Recent posts: ${JSON.stringify(fingerprints.slice(0, 5).map((f: Record<string, unknown>) => ({
  hook: f.hook_archetype,
  caption: (f.caption as string)?.slice(0, 100),
  engagement: f.engagement_score,
}))).slice(0, 800)}

Return JSON (no markdown):
{
  "visual_identity": { "dominant_colors": [{"hex":"#xxx","role":"primary"}], "type_style": "", "composition_patterns": "", "image_treatment": "", "whitespace_density": "", "recurring_motifs": [] },
  "voice_profile": { "sentence_length": "", "formality": "", "hooks_reused": [], "words_avoided": [] }
}`,
    }],
  });

  const text = summary.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let parsed;
  try {
    const cleaned = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = { visual_identity: {}, voice_profile: {} };
  }

  const context: CreativeContext = {
    visual_identity: {
      dominant_colors: parsed.visual_identity?.dominant_colors || [{ hex: '#000000', role: 'primary' }],
      type_style: parsed.visual_identity?.type_style || 'sans-serif',
      composition_patterns: parsed.visual_identity?.composition_patterns || 'centered layout',
      image_treatment: parsed.visual_identity?.image_treatment || 'clean, modern',
      whitespace_density: parsed.visual_identity?.whitespace_density || 'moderate',
      recurring_motifs: parsed.visual_identity?.recurring_motifs || [],
    },
    voice_profile: {
      sentence_length: parsed.voice_profile?.sentence_length || 'short',
      formality: parsed.voice_profile?.formality || 'casual-professional',
      hooks_reused: parsed.voice_profile?.hooks_reused || [],
      words_avoided: parsed.voice_profile?.words_avoided || [],
    },
    learned_preferences: {
      revision_patterns_summary: '',
      preferred_formats: {},
      approval_rate: 0,
    },
    last_refreshed: new Date().toISOString(),
    context_version: 1,
  };

  // Store in DB
  await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}`,
    {
      method: 'PATCH',
      headers: supaHeaders(),
      body: JSON.stringify({ creative_context: context }),
    },
  );

  return context;
}

/** Log a cost entry */
export async function logCost(
  brandIgId: string,
  generationId: string,
  callType: string,
  modelUsed: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  imageCount = 0,
) {
  const supabaseUrl = env.SUPABASE_URL!;
  await fetch(`${supabaseUrl}/rest/v1/creative_cost_log`, {
    method: 'POST',
    headers: supaHeaders(),
    body: JSON.stringify({
      brand_account_id: brandIgId,
      generation_id: generationId,
      call_type: callType,
      model_used: modelUsed,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      image_count: imageCount,
      cost_usd: costUsd,
    }),
  }).catch(() => {});
}

/** Log a taste entry */
export async function logTaste(
  brandIgId: string,
  generationId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  const supabaseUrl = env.SUPABASE_URL!;
  await fetch(`${supabaseUrl}/rest/v1/creative_taste_log`, {
    method: 'POST',
    headers: supaHeaders(),
    body: JSON.stringify({
      brand_account_id: brandIgId,
      generation_id: generationId,
      type,
      payload,
    }),
  }).catch(() => {});
}

/** Fetch the last N post thumbnails for visual reference */
export async function getRecentThumbnails(brandIgId: string, count = 5): Promise<string[]> {
  const supabaseUrl = env.SUPABASE_URL!;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${brandIgId}&select=intelligence&order=created_at.desc&limit=1`,
    { headers: supaHeaders() },
  );
  const rows = res.ok ? await res.json() : [];
  const intel = rows[0]?.intelligence || {};
  const posts = (intel.recentPosts || []) as Array<{ thumbnail?: string }>;
  return posts.slice(0, count).map((p) => p.thumbnail).filter(Boolean) as string[];
}
