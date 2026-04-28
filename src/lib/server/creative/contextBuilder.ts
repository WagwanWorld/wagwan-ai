import { env } from '$env/dynamic/private';

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

/** Full brand brief assembled for creative generation */
export interface BrandBrief {
  context: CreativeContext;
  identity: Record<string, unknown>;
  brandVoice: string;
  visualAnalysis: {
    colorPalette: string[];
    aesthetic: Record<string, string>;
    sceneCategories: Record<string, number>;
  };
  topPillars: Array<{ label: string; avgEngagement: number; description: string }>;
  topHookArchetypes: Array<{ archetype: string; count: number; avgEngagement: number }>;
  audiencePersonas: Array<{ name: string; description: string }>;
  recentTopPosts: Array<{
    caption: string;
    hookArchetype: string;
    engagement: number;
    mediaType: string;
    compositionType: string;
  }>;
  commentInsights: Array<{ topic: string; intent: string; sentiment: string; count: number }>;
  findings: Array<{ type: string; title: string; suggestedAction: string }>;
  thumbnailUrls: string[];
}

const supaHeaders = () => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * Assemble the FULL brand brief for creative generation.
 * Pulls from ALL available brand intelligence: identity, snapshots,
 * fingerprints, pillars, comments, findings.
 */
export async function assembleBrandBrief(brandIgId: string): Promise<BrandBrief> {
  const supabaseUrl = env.SUPABASE_URL!;
  const headers = supaHeaders();

  // Parallel fetch ALL brand data
  const [brandRes, snapRes, fingerprintRes, pillarRes, commentRes, findingRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}&select=brand_identity,brand_voice,creative_context&limit=1`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${brandIgId}&select=intelligence&order=created_at.desc&limit=1`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/brand_fingerprints?brand_ig_id=eq.${brandIgId}&order=quality_weighted_engagement.desc&limit=15&select=caption_text,first_line_text,hook_archetype,cta_type,media_type,composition_type,quality_weighted_engagement,likes,comments,saves,dominant_hue,saturation`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/content_pillars?brand_ig_id=eq.${brandIgId}&order=avg_quality_engagement.desc&limit=5&select=label,description,avg_quality_engagement,avg_save_rate`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/comment_clusters?brand_ig_id=eq.${brandIgId}&order=mention_count.desc&limit=8&select=topic_key,intent,sentiment,mention_count`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/insight_findings?brand_ig_id=eq.${brandIgId}&order=created_at.desc&limit=5&select=finding_type,title,suggested_action`, { headers }),
  ]);

  const brand = (await brandRes.json())?.[0] || {};
  const snap = (snapRes.ok ? await snapRes.json() : [])?.[0]?.intelligence || {};
  const fingerprints = fingerprintRes.ok ? await fingerprintRes.json() : [];
  const pillars = pillarRes.ok ? await pillarRes.json() : [];
  const comments = commentRes.ok ? await commentRes.json() : [];
  const findings = findingRes.ok ? await findingRes.json() : [];

  const identity = (brand.brand_identity || {}) as Record<string, unknown>;
  const existingContext = brand.creative_context as CreativeContext | null;

  // Extract visual analysis from identity (populated by extract-identity)
  const visual = (identity.visual || {}) as Record<string, unknown>;
  const visualAnalysis = {
    colorPalette: (visual.colorPalette as string[]) || [],
    aesthetic: (visual.aesthetic as Record<string, string>) || {},
    sceneCategories: (visual.sceneCategories as Record<string, number>) || {},
  };

  // Aggregate hook archetypes with engagement scores
  const hookMap = new Map<string, { count: number; totalEng: number }>();
  for (const fp of fingerprints) {
    const arch = (fp.hook_archetype as string) || 'generic';
    const existing = hookMap.get(arch) || { count: 0, totalEng: 0 };
    hookMap.set(arch, { count: existing.count + 1, totalEng: existing.totalEng + ((fp.quality_weighted_engagement as number) || 0) });
  }
  const topHookArchetypes = Array.from(hookMap.entries())
    .map(([archetype, data]) => ({ archetype, count: data.count, avgEngagement: Math.round(data.totalEng / data.count) }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Get thumbnail URLs from recent posts
  const recentPosts = (snap.recentPosts || []) as Array<{ thumbnail?: string }>;
  const thumbnailUrls = recentPosts.map((p) => p.thumbnail).filter(Boolean) as string[];

  // Audience personas
  const audiencePortrait = (snap.audiencePortrait || {}) as Record<string, unknown>;
  const personas = (audiencePortrait.personas || []) as Array<{ name: string; description: string }>;

  // Build or reuse creative context
  const context = existingContext?.context_version
    ? existingContext
    : buildCreativeContextFromData(brandIgId, brand, visual, fingerprints);

  return {
    context,
    identity,
    brandVoice: (brand.brand_voice as string) || 'Bold',
    visualAnalysis,
    topPillars: pillars.map((p: Record<string, unknown>) => ({
      label: p.label as string,
      avgEngagement: p.avg_quality_engagement as number,
      description: (p.description as string) || '',
    })),
    topHookArchetypes,
    audiencePersonas: personas,
    recentTopPosts: fingerprints.slice(0, 5).map((fp: Record<string, unknown>) => ({
      caption: ((fp.caption_text as string) || '').slice(0, 150),
      hookArchetype: (fp.hook_archetype as string) || 'unknown',
      engagement: (fp.quality_weighted_engagement as number) || 0,
      mediaType: (fp.media_type as string) || 'IMAGE',
      compositionType: (fp.composition_type as string) || 'unknown',
    })),
    commentInsights: comments.map((c: Record<string, unknown>) => ({
      topic: c.topic_key as string,
      intent: c.intent as string,
      sentiment: c.sentiment as string,
      count: (c.mention_count as number) || 0,
    })),
    findings: findings.map((f: Record<string, unknown>) => ({
      type: f.finding_type as string,
      title: f.title as string,
      suggestedAction: (f.suggested_action as string) || '',
    })),
    thumbnailUrls,
  };
}

function buildCreativeContextFromData(
  brandIgId: string,
  brand: Record<string, unknown>,
  visual: Record<string, unknown>,
  fingerprints: Array<Record<string, unknown>>,
): CreativeContext {
  const brandVoice = (brand.brand_voice || 'Bold') as string;
  const colorPalette = (visual.colorPalette as string[]) || [];
  const aesthetic = (visual.aesthetic as Record<string, string>) || {};

  const context: CreativeContext = {
    visual_identity: {
      dominant_colors: colorPalette.length > 0
        ? colorPalette.map((hex, i) => ({ hex, role: i === 0 ? 'primary' : i === 1 ? 'secondary' : 'accent' }))
        : [{ hex: '#000000', role: 'primary' }],
      type_style: aesthetic.composition === 'minimal' ? 'clean sans-serif, generous whitespace' : 'bold sans-serif headlines',
      composition_patterns: aesthetic.composition || 'balanced',
      image_treatment: `${aesthetic.brightness || 'medium'} brightness, ${aesthetic.tone || 'neutral'} tone`,
      whitespace_density: aesthetic.composition === 'minimal' ? 'high' : aesthetic.composition === 'busy' ? 'low' : 'moderate',
      recurring_motifs: [],
    },
    voice_profile: {
      sentence_length: brandVoice === 'Bold' || brandVoice === 'Hype' ? 'short, punchy' : 'moderate',
      formality: brandVoice === 'Premium' ? 'formal' : brandVoice === 'Playful' ? 'casual' : 'casual-professional',
      hooks_reused: fingerprints.slice(0, 5).map((fp) => (fp.first_line_text as string) || '').filter(Boolean),
      words_avoided: [],
    },
    learned_preferences: {
      revision_patterns_summary: '',
      preferred_formats: {},
      approval_rate: 0,
    },
    last_refreshed: new Date().toISOString(),
    context_version: 1,
  };

  // Store async (fire and forget)
  const supabaseUrl = env.SUPABASE_URL!;
  fetch(`${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${brandIgId}`, {
    method: 'PATCH',
    headers: supaHeaders(),
    body: JSON.stringify({ creative_context: context }),
  }).catch(() => {});

  return context;
}

/** Log a cost entry */
export async function logCost(
  brandIgId: string, generationId: string, callType: string,
  modelUsed: string, inputTokens: number, outputTokens: number,
  costUsd: number, imageCount = 0,
) {
  const supabaseUrl = env.SUPABASE_URL!;
  await fetch(`${supabaseUrl}/rest/v1/creative_cost_log`, {
    method: 'POST', headers: supaHeaders(),
    body: JSON.stringify({ brand_account_id: brandIgId, generation_id: generationId, call_type: callType, model_used: modelUsed, input_tokens: inputTokens, output_tokens: outputTokens, image_count: imageCount, cost_usd: costUsd }),
  }).catch(() => {});
}

/** Log a taste entry */
export async function logTaste(
  brandIgId: string, generationId: string, type: string, payload: Record<string, unknown>,
) {
  const supabaseUrl = env.SUPABASE_URL!;
  await fetch(`${supabaseUrl}/rest/v1/creative_taste_log`, {
    method: 'POST', headers: supaHeaders(),
    body: JSON.stringify({ brand_account_id: brandIgId, generation_id: generationId, type, payload }),
  }).catch(() => {});
}
