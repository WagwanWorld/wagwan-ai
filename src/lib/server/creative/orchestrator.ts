import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { CREATIVE_DIRECTOR_SYSTEM_PROMPT, DIRECTION_OUTPUT_SCHEMA, type CreativeDirection } from './directionPrompt';
import { assembleBrandBrief, logCost, type BrandBrief } from './contextBuilder';
import { generateImage } from './imageGenerator';
// Satori compositor removed — GPT handles everything including logo
import { runQC } from './qc';
import { uploadCreativeToGCS } from '$lib/server/marketplace/gcsUpload';

// ─── JSON extraction helper ───

/** Extract a JSON object from text that may contain markdown fences, preamble, or trailing text */
function extractJSON<T>(text: string): T {
  // Strategy 1: Try parsing the whole text directly
  try { return JSON.parse(text.trim()); } catch { /* continue */ }

  // Strategy 2: Strip markdown fences
  const fenceStripped = text
    .replace(/^[\s\S]*?```(?:json)?\s*\n/i, '')
    .replace(/\n\s*```[\s\S]*$/i, '')
    .trim();
  try { return JSON.parse(fenceStripped); } catch { /* continue */ }

  // Strategy 3: Find the outermost { ... } by counting braces
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let lastBrace = -1;
    for (let i = firstBrace; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) { lastBrace = i; break; }
      }
    }
    if (lastBrace !== -1) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      try { return JSON.parse(candidate); } catch { /* continue */ }
    }
  }

  throw new Error(text.slice(0, 200));
}

// ─── Types ───

export interface DirectInput {
  brandIgId: string;
  copy: string;
  caption?: string;
  lockedPhrases?: string[];
  brief?: string;
  brandVoice?: string;
  generationId: string;
}

export interface DirectResult {
  direction: CreativeDirection;
  imagePrompt: string;
  brandBrief: BrandBrief;
  directionCost: number;
}

export interface RenderInput {
  brandIgId: string;
  imagePrompt: string;
  direction: CreativeDirection;
  generationId: string;
  version: number;
}

export interface RenderResult {
  imageUrl: string;
  qcReport: { textLegible: boolean; logoOk: boolean; paletteOk: boolean; safeZoneOk: boolean; issues: string[]; passed: boolean };
  renderCost: number;
}

const supaHeaders = () => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

// ─── Brand Context Prompt Builder ───

function buildBrandContextPrompt(brief: BrandBrief): string {
  const parts: string[] = [];

  const vi = brief.context.visual_identity;
  parts.push(`VISUAL IDENTITY:
- Brand colors: ${vi.dominant_colors.map(c => `${c.hex} (${c.role})`).join(', ')}
- Image treatment: ${vi.image_treatment}
- Composition: ${vi.composition_patterns}
- Whitespace: ${vi.whitespace_density}
- Type style: ${vi.type_style}
${vi.recurring_motifs.length ? `- Motifs: ${vi.recurring_motifs.join(', ')}` : ''}`);

  if (brief.visualAnalysis.colorPalette.length > 0) {
    parts.push(`FEED COLOR PALETTE (from actual posts): ${brief.visualAnalysis.colorPalette.join(', ')}`);
  }
  if (Object.keys(brief.visualAnalysis.aesthetic).length > 0) {
    const a = brief.visualAnalysis.aesthetic;
    parts.push(`FEED AESTHETIC: brightness=${a.brightness || 'medium'}, tone=${a.tone || 'neutral'}, composition=${a.composition || 'balanced'}`);
  }

  const vp = brief.context.voice_profile;
  parts.push(`VOICE: ${brief.brandVoice} tone, ${vp.formality}, ${vp.sentence_length} sentences
${vp.hooks_reused.length ? `Best hooks: "${vp.hooks_reused.slice(0, 3).join('", "')}"` : ''}`);

  if (brief.topPillars.length > 0) {
    parts.push(`TOP CONTENT PILLARS:\n${brief.topPillars.slice(0, 3).map(p => `- ${p.label}: ${p.description || 'N/A'}`).join('\n')}`);
  }

  if (brief.recentTopPosts.length > 0) {
    parts.push(`TOP POSTS (match these patterns):\n${brief.recentTopPosts.slice(0, 3).map((p, i) => `${i + 1}. [${p.compositionType}] "${p.caption}" (hook: ${p.hookArchetype})`).join('\n')}`);
  }

  if (brief.audiencePersonas.length > 0) {
    parts.push(`AUDIENCE: ${brief.audiencePersonas.slice(0, 3).map(p => `${p.name} — ${p.description}`).join(' | ')}`);
  }

  return parts.join('\n\n');
}

// ─── Step 1: Claude Direction (returns curated image prompt for user to edit) ───

export async function getDirection(input: DirectInput): Promise<DirectResult> {
  const { brandIgId, copy, caption, lockedPhrases, brief, brandVoice, generationId } = input;

  const brandBrief = await assembleBrandBrief(brandIgId);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });

  const directionParts: Anthropic.Messages.ContentBlockParam[] = [];

  // Fetch moodboard images and send to Claude for analysis
  const supabaseUrl = env.SUPABASE_URL!;
  const moodRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${brandIgId}&type=eq.moodboard&order=created_at.desc&limit=4`,
    { headers: supaHeaders() },
  );
  const moodboardAssets = moodRes.ok ? await moodRes.json() : [];

  if (moodboardAssets.length > 0) {
    directionParts.push({ type: 'text', text: `MOODBOARD — These are the creative references chosen by the brand. Study them deeply. Your design MUST feel like it belongs in this visual world. Analyze: color language, typography treatment, composition style, energy level, craft quality, how text and visuals integrate:` });
    for (const asset of moodboardAssets.slice(0, 3)) {
      try {
        const imgRes = await fetch(asset.url);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          directionParts.push({
            type: 'image',
            source: { type: 'base64', media_type: contentType as 'image/jpeg', data: base64 },
          });
        }
      } catch { /* skip */ }
    }
  }

  // Send brand post thumbnails
  const thumbsToSend = brandBrief.thumbnailUrls.slice(0, 2);
  for (let i = 0; i < thumbsToSend.length; i++) {
    try {
      const imgRes = await fetch(thumbsToSend[i]);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        directionParts.push({ type: 'text', text: `BRAND POST ${i + 1}:` });
        directionParts.push({
          type: 'image',
          source: { type: 'base64', media_type: contentType as 'image/jpeg', data: base64 },
        });
      }
    } catch { /* skip */ }
  }

  let processedCopy = copy;
  if (lockedPhrases?.length) {
    processedCopy += `\nLOCKED TEXT (compositor will render verbatim): ${lockedPhrases.join(', ')}`;
  }

  directionParts.push({
    type: 'text',
    text: `${buildBrandContextPrompt(brandBrief)}
${brandVoice ? `\nBRAND VOICE: ${brandVoice}` : ''}
---

COPY TO DESIGN FOR:
${processedCopy}
${caption ? `\nCAPTION: ${caption}` : ''}${brief ? `\nBRIEF: ${brief}` : ''}

FORMAT: 4:5 static (1080x1350)

YOUR TASK: Read the copy first. Feel its energy. Then design something that EMBODIES that energy.

CRITICAL — THE imageModelPrompt FIELD:
This prompt goes to OpenAI's image generator which CANNOT see the moodboard images. YOU are the bridge. You must:

1. DESCRIBE the moodboard's visual language in vivid detail — what you see in those references. Colors, type treatment, composition, texture, energy. Paint a picture with words so the image model can recreate that world.

2. Then describe THIS specific design within that visual language — how the copy, colors, typography, and layout come together as one composition.

3. Write it like a creative director briefing a designer who hasn't seen the moodboard — be specific enough that they could recreate the aesthetic from your words alone.

GOOD: "Moodboard aesthetic: high-contrast brutalist design, blood-red and black color blocking, heavyweight condensed typography that dominates the frame, minimal elements, streetwear-meets-Swiss-precision energy. Raw but intentional.

For this post: That same blood-red canvas fills the entire frame — vivid, uncompromising. Heavyweight condensed white type smashes across the top half reading 'WAGWAN WITH YOUR INSTAGRAM?' — the letters feel architectural, like they're carved into the red. Below, a stark transition to black. Body copy sits small and clean in the dark space — a whisper after a shout. A single white diagonal slash cuts across the canvas, breaking the grid, adding tension. Everything bleeds confidence."

BAD: "Bold white text on red background, left-aligned"
BAD: "A nightclub scene with neon lights"

The brief should make someone FEEL the design before they see it.

${DIRECTION_OUTPUT_SCHEMA}`,
  });

  // Retry once on transient API errors (500s)
  let directionResponse;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      directionResponse = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        system: CREATIVE_DIRECTOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: directionParts }],
      });
      break;
    } catch (e) {
      if (attempt === 1) throw e;
      // Wait 2s before retry on first failure
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!directionResponse) throw new Error('Claude direction failed after retry');

  const directionText = directionResponse.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let direction: CreativeDirection;
  try {
    direction = extractJSON(directionText);
  } catch (parseErr) {
    if (directionResponse.stop_reason === 'max_tokens') {
      throw new Error('Direction response was truncated — try a shorter copy input');
    }
    throw new Error(`Claude returned invalid direction JSON: ${(parseErr as Error).message}`);
  }

  const inputTokens = directionResponse.usage?.input_tokens || 0;
  const outputTokens = directionResponse.usage?.output_tokens || 0;
  const dirCost = (inputTokens * 0.8 + outputTokens * 4) / 1_000_000;
  await logCost(brandIgId, generationId, 'direction', 'claude-haiku-4-5-20251001', inputTokens, outputTokens, dirCost);

  return {
    direction,
    imagePrompt: direction.imageModelPrompt || direction.designDirection.imagery || '',
    brandBrief,
    directionCost: dirCost,
  };
}

// ─── Step 2: Render (Gemini generates COMPLETE creative + logo overlay + QC) ───

export async function renderImage(input: RenderInput): Promise<RenderResult> {
  const { brandIgId, imagePrompt, direction, generationId, version } = input;
  let renderCost = 0;

  const supabaseUrl = env.SUPABASE_URL!;

  // Fetch brand logo
  const logoRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${brandIgId}&type=eq.logo_primary&is_default=eq.true&limit=1`,
    { headers: supaHeaders() },
  );
  const logos = logoRes.ok ? await logoRes.json() : [];
  const logoUrl = logos[0]?.url || null;

  // Fetch moodboard assets
  const moodRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${brandIgId}&type=eq.moodboard&order=created_at.desc&limit=5`,
    { headers: supaHeaders() },
  );
  const moodboardAssets = moodRes.ok ? await moodRes.json() : [];

  // Get style references from past posts (send actual images to Gemini)
  const brandBrief = await assembleBrandBrief(brandIgId);
  const styleReferences: Array<{ base64: string; mimeType: string; source?: 'moodboard' | 'brand-post' }> = [];
  for (const thumbUrl of brandBrief.thumbnailUrls.slice(0, 3)) {
    try {
      const refRes = await fetch(thumbUrl);
      if (refRes.ok) {
        const buffer = await refRes.arrayBuffer();
        styleReferences.push({
          base64: Buffer.from(buffer).toString('base64'),
          mimeType: refRes.headers.get('content-type') || 'image/jpeg',
          source: 'brand-post',
        });
      }
    } catch { /* skip */ }
  }

  // Fetch moodboard images as base64 — these take priority over brand posts
  const moodboardRefs: Array<{ base64: string; mimeType: string; source?: 'moodboard' | 'brand-post' }> = [];
  for (const asset of moodboardAssets.slice(0, 4)) {
    try {
      const res = await fetch(asset.url);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        moodboardRefs.push({
          base64: Buffer.from(buffer).toString('base64'),
          mimeType: res.headers.get('content-type') || 'image/jpeg',
          source: 'moodboard',
        });
      }
    } catch { /* skip */ }
  }

  // Moodboard takes priority — prepend before brand post refs
  const allStyleRefs = [...moodboardRefs, ...styleReferences];

  // Brand palette for Gemini
  const brandPaletteHexes = [
    ...(brandBrief.visualAnalysis.colorPalette || []),
    ...direction.designDirection.palette.map((c) => c.hex),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);

  // Generate COMPLETE creative via OpenAI gpt-image-1
  // GPT handles EVERYTHING: visuals, text, AND logo placement
  const imageResult = await generateImage(direction, {
    styleReferences: allStyleRefs,
    aspectRatio: '4:5',
    brandPalette: brandPaletteHexes,
    userPromptOverride: imagePrompt,
    quality: 'high',
    logoUrl: logoUrl || undefined,
  });

  const imgCost = imageResult.quality === 'high' ? 0.19 : imageResult.quality === 'medium' ? 0.07 : 0.02;
  renderCost += imgCost;
  await logCost(brandIgId, generationId, 'image_generation', imageResult.model, 0, 0, imgCost, 1);

  // No Satori composite — GPT renders everything including logo
  const finalBase64 = imageResult.base64;

  // QC pass
  const paletteHexes = direction.designDirection.palette.map((c) => c.hex);
  const qcReport = await runQC(finalBase64, 'image/png', paletteHexes, direction.assets.logo?.position || 'bottom-right');
  renderCost += 0.003;
  await logCost(brandIgId, generationId, 'qc', 'claude-haiku-4-5-20251001', 0, 0, 0.003);

  // Upload to GCS
  const finalBuffer = Buffer.from(finalBase64, 'base64');
  const fileName = `creative-${generationId}-v${version}.png`;
  const file = new File([finalBuffer], fileName, { type: 'image/png' });
  const uploadResult = await uploadCreativeToGCS(file, brandIgId);

  // Store version in DB
  await fetch(`${supabaseUrl}/rest/v1/creative_generation_versions`, {
    method: 'POST',
    headers: supaHeaders(),
    body: JSON.stringify({
      generation_id: generationId,
      version,
      image_gcs_url: uploadResult.url,
      direction_payload: direction,
      copy_payload: { onImage: direction.copy.onImage, caption: direction.copy.caption, cta: direction.copy.cta, hashtags: direction.copy.hashtags },
      qc_report: qcReport,
      cost_usd: renderCost,
    }),
  });

  return { imageUrl: uploadResult.url, qcReport, renderCost };
}
