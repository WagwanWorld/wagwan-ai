import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { CREATIVE_DIRECTOR_SYSTEM_PROMPT, DIRECTION_OUTPUT_SCHEMA, type CreativeDirection } from './directionPrompt';
import { assembleBrandBrief, logCost, type BrandBrief } from './contextBuilder';
import { generateImage } from './imageGenerator';
import { compositeLogoOnly } from './compositor';
import { runQC } from './qc';
import { uploadCreativeToGCS } from '$lib/server/marketplace/gcsUpload';

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

  // Send past post thumbnails as visual references (2 max — reduces prompt size + cost)
  const thumbsToSend = brandBrief.thumbnailUrls.slice(0, 2);
  for (let i = 0; i < thumbsToSend.length; i++) {
    try {
      const imgRes = await fetch(thumbsToSend[i]);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        directionParts.push({ type: 'text', text: `BRAND POST ${i + 1} — match this style:` });
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
${brandVoice ? `\nBRAND VOICE OVERRIDE: ${brandVoice} — Apply this tone throughout the creative direction, copy, and caption.` : ''}
---

COPY TO DESIGN FOR:
${processedCopy}
${caption ? `\nCAPTION: ${caption}` : ''}${brief ? `\nBRIEF: ${brief}` : ''}

FORMAT: 4:5 static (1080x1350)

CRITICAL — THE imageModelPrompt FIELD:
This is the MOST important field. It will be sent to Gemini (Nano Banana) which generates the COMPLETE creative — both the visual scene AND renders the text on the image.
Write it as a detailed, specific scene description — like you're briefing a photographer or art director.
Include: scene/subject, lighting, camera angle, color palette (use the brand hex codes), mood, texture, style.
The on-image text from copy.onImage will be sent separately to Gemini — so focus on the VISUAL ENVIRONMENT in this prompt.
Example: "Clean dark charcoal (#1A1A1A) background with subtle gradient to deep navy. Geometric accent shapes in brand orange (#E8833A) — thin diagonal lines. Soft studio lighting, matte texture, premium minimalist feel. Generous negative space in center for text."

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
    let cleaned = directionText
      .replace(/^[\s\S]*?```json?\s*\n?/i, '')
      .replace(/\n?```[\s\S]*$/i, '')
      .trim();
    if (!cleaned || cleaned === directionText.trim()) cleaned = directionText.trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    direction = JSON.parse(cleaned);
  } catch {
    if (directionResponse.stop_reason === 'max_tokens') {
      throw new Error('Direction response was truncated — try a shorter copy input');
    }
    throw new Error(`Claude returned invalid direction JSON: ${directionText.slice(0, 300)}`);
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

  // Get style references from past posts (send actual images to Gemini)
  const brandBrief = await assembleBrandBrief(brandIgId);
  const styleReferences: Array<{ base64: string; mimeType: string }> = [];
  for (const thumbUrl of brandBrief.thumbnailUrls.slice(0, 3)) {
    try {
      const refRes = await fetch(thumbUrl);
      if (refRes.ok) {
        const buffer = await refRes.arrayBuffer();
        styleReferences.push({
          base64: Buffer.from(buffer).toString('base64'),
          mimeType: refRes.headers.get('content-type') || 'image/jpeg',
        });
      }
    } catch { /* skip */ }
  }

  // Brand palette for Gemini
  const brandPaletteHexes = [
    ...(brandBrief.visualAnalysis.colorPalette || []),
    ...direction.designDirection.palette.map((c) => c.hex),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);

  // Generate COMPLETE creative — Gemini renders everything including text
  const imageResult = await generateImage(direction, {
    styleReferences,
    aspectRatio: '4:5',
    brandPalette: brandPaletteHexes,
    userPromptOverride: imagePrompt,
  });

  const imgCost = 0.039 + ((imageResult.tokensUsed || 500) * 0.3) / 1_000_000;
  renderCost += imgCost;
  await logCost(brandIgId, generationId, 'image_generation', 'gemini-2.5-flash-image', imageResult.tokensUsed || 500, 1290, imgCost, 1);

  // Logo-only composite (Gemini handled all text)
  const composited = await compositeLogoOnly({
    imageBase64: imageResult.base64,
    imageMimeType: imageResult.mimeType,
    logoUrl: logoUrl || undefined,
    logoPosition: direction.assets.logo?.position,
  });

  // QC pass
  const finalBase64 = composited.pngBuffer.toString('base64');
  const paletteHexes = direction.designDirection.palette.map((c) => c.hex);
  const qcReport = await runQC(finalBase64, 'image/png', paletteHexes, direction.assets.logo?.position || 'bottom-right');
  renderCost += 0.003;
  await logCost(brandIgId, generationId, 'qc', 'claude-haiku-4-5-20251001', 0, 0, 0.003);

  // Upload to GCS
  const fileName = `creative-${generationId}-v${version}.png`;
  const file = new File([composited.pngBuffer], fileName, { type: 'image/png' });
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
