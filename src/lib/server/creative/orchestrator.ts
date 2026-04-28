import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { CREATIVE_DIRECTOR_SYSTEM_PROMPT, DIRECTION_OUTPUT_SCHEMA, type CreativeDirection } from './directionPrompt';
import { assembleBrandBrief, logCost, type BrandBrief } from './contextBuilder';
import { generateImage } from './imageGenerator';
import { compositeImage } from './compositor';
import { runQC } from './qc';
import { uploadCreativeToGCS } from '$lib/server/marketplace/gcsUpload';

export interface GenerateVisualInput {
  brandIgId: string;
  copy: string;
  caption?: string;
  format?: string;
  lockedPhrases?: string[];
  brief?: string;
  generationId: string;
  version: number;
}

export interface GenerateVisualResult {
  imageUrl: string;
  direction: CreativeDirection;
  qcReport: { textLegible: boolean; logoOk: boolean; paletteOk: boolean; safeZoneOk: boolean; issues: string[]; passed: boolean };
  totalCost: number;
}

const supaHeaders = () => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * Build the rich brand context block for Claude's direction prompt.
 * This is what makes the output brand-specific vs generic.
 */
function buildBrandContextPrompt(brief: BrandBrief): string {
  const parts: string[] = [];

  // 1. Visual identity — the most important for image generation
  const vi = brief.context.visual_identity;
  parts.push(`VISUAL IDENTITY:
- Brand colors: ${vi.dominant_colors.map(c => `${c.hex} (${c.role})`).join(', ')}
- Image treatment: ${vi.image_treatment}
- Composition: ${vi.composition_patterns}
- Whitespace: ${vi.whitespace_density}
- Type style: ${vi.type_style}
${vi.recurring_motifs.length ? `- Motifs: ${vi.recurring_motifs.join(', ')}` : ''}`);

  // 2. Extracted visual analysis from Instagram feed
  if (brief.visualAnalysis.colorPalette.length > 0) {
    parts.push(`FEED COLOR PALETTE (extracted from actual posts): ${brief.visualAnalysis.colorPalette.join(', ')}`);
  }
  if (Object.keys(brief.visualAnalysis.aesthetic).length > 0) {
    const a = brief.visualAnalysis.aesthetic;
    parts.push(`FEED AESTHETIC: brightness=${a.brightness || 'medium'}, tone=${a.tone || 'neutral'}, composition=${a.composition || 'balanced'}, indoor/outdoor=${a.indoorOutdoorRatio || 'mixed'}`);
  }
  if (Object.keys(brief.visualAnalysis.sceneCategories).length > 0) {
    const scenes = Object.entries(brief.visualAnalysis.sceneCategories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([scene, pct]) => `${scene} (${Math.round(pct * 100)}%)`)
      .join(', ');
    parts.push(`FEED SCENE MIX: ${scenes}`);
  }

  // 3. Voice profile
  const vp = brief.context.voice_profile;
  parts.push(`VOICE: ${brief.brandVoice} tone, ${vp.formality}, ${vp.sentence_length} sentences
${vp.hooks_reused.length ? `Best-performing hooks: "${vp.hooks_reused.slice(0, 3).join('", "')}"` : ''}`);

  // 4. Top performing content (what actually works for this brand)
  if (brief.topPillars.length > 0) {
    parts.push(`TOP CONTENT PILLARS (by engagement):
${brief.topPillars.slice(0, 3).map(p => `- ${p.label}: ${p.description || 'N/A'} (avg engagement: ${p.avgEngagement})`).join('\n')}`);
  }

  // 5. What the audience responds to
  if (brief.recentTopPosts.length > 0) {
    parts.push(`TOP PERFORMING POSTS (design patterns to mirror):
${brief.recentTopPosts.slice(0, 3).map((p, i) => `${i + 1}. [${p.mediaType}/${p.compositionType}] "${p.caption}" (engagement: ${p.engagement}, hook: ${p.hookArchetype})`).join('\n')}`);
  }

  // 6. Audience personas
  if (brief.audiencePersonas.length > 0) {
    parts.push(`TARGET AUDIENCE: ${brief.audiencePersonas.slice(0, 3).map(p => `${p.name} — ${p.description}`).join(' | ')}`);
  }

  // 7. Comment insights (what audience is asking about)
  if (brief.commentInsights.length > 0) {
    const topTopics = brief.commentInsights.slice(0, 3)
      .map(c => `${c.topic} (${c.sentiment}, ${c.count} mentions)`)
      .join(', ');
    parts.push(`AUDIENCE IS TALKING ABOUT: ${topTopics}`);
  }

  // 8. Current findings/opportunities
  if (brief.findings.length > 0) {
    const actionable = brief.findings.slice(0, 2)
      .map(f => `[${f.type}] ${f.title}: ${f.suggestedAction}`)
      .join(' | ');
    parts.push(`CURRENT INSIGHTS: ${actionable}`);
  }

  return parts.join('\n\n');
}

export async function generateVisual(input: GenerateVisualInput): Promise<GenerateVisualResult> {
  const { brandIgId, copy, caption, lockedPhrases, brief, generationId, version } = input;
  let totalCost = 0;

  // 1. Assemble the FULL brand brief (parallel fetches)
  const brandBrief = await assembleBrandBrief(brandIgId);

  // 2. Fetch brand logo
  const supabaseUrl = env.SUPABASE_URL!;
  const logoRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${brandIgId}&type=eq.logo_primary&is_default=eq.true&limit=1`,
    { headers: supaHeaders() },
  );
  const logos = logoRes.ok ? await logoRes.json() : [];
  const logoUrl = logos[0]?.url || null;

  // 3. Send past post thumbnails to Claude as visual references
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  const directionModel = 'claude-haiku-4-5-20251001';

  const directionParts: Anthropic.Messages.ContentBlockParam[] = [];

  // Send up to 3 top-performing post thumbnails as visual style references
  const thumbsToSend = brandBrief.thumbnailUrls.slice(0, 3);
  for (let i = 0; i < thumbsToSend.length; i++) {
    try {
      const imgRes = await fetch(thumbsToSend[i]);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        directionParts.push({ type: 'text', text: `BRAND POST REFERENCE ${i + 1} — match this visual style, color grading, and composition:` });
        directionParts.push({
          type: 'image',
          source: { type: 'base64', media_type: contentType as 'image/jpeg', data: base64 },
        });
      }
    } catch { /* skip */ }
  }

  // Build the full brand context
  let processedCopy = copy;
  if (lockedPhrases?.length) {
    processedCopy += `\nLOCKED TEXT (must be composited verbatim): ${lockedPhrases.join(', ')}`;
  }

  const brandContextPrompt = buildBrandContextPrompt(brandBrief);

  directionParts.push({
    type: 'text',
    text: `${brandContextPrompt}

---

COPY TO CREATE A VISUAL FOR:
${processedCopy}
${caption ? `\nSUGGESTED CAPTION: ${caption}` : ''}
${brief ? `\nBRIEF: ${brief}` : ''}

FORMAT: 4:5 static (1080x1350)
${logoUrl ? 'Brand logo available — will be composited in the position you specify.' : 'No logo uploaded.'}

CRITICAL RULES:
1. The imageModelPrompt MUST describe ONLY the background scene — NO text, NO words, NO letters.
2. All on-image text goes in copy.onImage and will be rendered by a separate compositor with real fonts.
3. Use the brand's actual color palette (hex codes above) as the dominant visual tones.
4. Match the visual style of the reference images above — same mood, same color grading, same level of sophistication.
5. The output must look like it belongs on this brand's feed. If it wouldn't fit next to the reference posts, it's wrong.

${DIRECTION_OUTPUT_SCHEMA}`,
  });

  const directionResponse = await client.messages.create({
    model: directionModel,
    max_tokens: 3000,
    system: CREATIVE_DIRECTOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: directionParts }],
  });

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
  totalCost += dirCost;
  await logCost(brandIgId, generationId, 'direction', directionModel, inputTokens, outputTokens, dirCost);

  // 4. Generate BACKGROUND image via Gemini
  // Clean the imageModelPrompt of any text references
  const cleanedImagePrompt = (direction.imageModelPrompt || direction.designDirection.imagery || '')
    .replace(/text|copy|headline|caption|cta|call.to.action|"[^"]{10,}"/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const scenePrompt = cleanedImagePrompt.length > 30
    ? cleanedImagePrompt
    : 'Professional, modern, clean brand background with subtle depth and texture';

  // Get brand palette hex codes
  const brandPaletteHexes = [
    ...(brandBrief.visualAnalysis.colorPalette || []),
    ...direction.designDirection.palette.map((c) => c.hex),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5); // dedupe, max 5

  // Use first thumbnail as style reference for Gemini
  let styleRefBase64: string | undefined;
  if (thumbsToSend.length > 0) {
    try {
      const refRes = await fetch(thumbsToSend[0]);
      if (refRes.ok) {
        const buffer = await refRes.arrayBuffer();
        styleRefBase64 = Buffer.from(buffer).toString('base64');
      }
    } catch { /* no style ref */ }
  }

  const imageResult = await generateImage(scenePrompt, {
    styleReferenceBase64: styleRefBase64,
    aspectRatio: '4:5',
    brandPalette: brandPaletteHexes,
  });

  const imgInputTokens = imageResult.tokensUsed || 500;
  const imgCost = 0.039 + (imgInputTokens * 0.3) / 1_000_000;
  totalCost += imgCost;
  await logCost(brandIgId, generationId, 'image_generation', 'gemini-2.5-flash-image', imgInputTokens, 1290, imgCost, 1);

  // 5. Composite brand overlay (ALL text + logo)
  const composited = await compositeImage({
    backgroundBase64: imageResult.base64,
    backgroundMimeType: imageResult.mimeType,
    direction,
    logoUrl: logoUrl || undefined,
    brandColors: direction.designDirection.palette,
  });

  // 6. QC pass
  let qcReport = { textLegible: true, logoOk: true, paletteOk: true, safeZoneOk: true, issues: [] as string[], passed: true };
  const skipQC = brandBrief.context.learned_preferences.approval_rate > 0.8 && brandBrief.context.context_version > 3;

  if (!skipQC) {
    const compositedBase64 = composited.pngBuffer.toString('base64');
    const paletteHexes = direction.designDirection.palette.map((c) => c.hex);
    qcReport = await runQC(compositedBase64, 'image/png', paletteHexes, direction.assets.logo.position);

    const qcCost = 0.003;
    totalCost += qcCost;
    await logCost(brandIgId, generationId, 'qc', 'claude-haiku-4-5-20251001', 0, 0, qcCost);

    if (!qcReport.passed) {
      const retryImage = await generateImage(
        scenePrompt + '\n\nSTYLE: Clean, professional, high-end brand aesthetic. Use solid color backgrounds or subtle gradients with the brand palette. Minimalist composition with clear negative space.',
        { styleReferenceBase64: styleRefBase64, aspectRatio: '4:5', brandPalette: brandPaletteHexes },
      );
      const retryComposited = await compositeImage({
        backgroundBase64: retryImage.base64,
        backgroundMimeType: retryImage.mimeType,
        direction,
        logoUrl: logoUrl || undefined,
        brandColors: direction.designDirection.palette,
      });
      const retryBase64 = retryComposited.pngBuffer.toString('base64');
      const retryQc = await runQC(retryBase64, 'image/png', paletteHexes, direction.assets.logo.position);

      totalCost += imgCost + 0.003;
      Object.assign(qcReport, retryQc);
      composited.pngBuffer = retryComposited.pngBuffer;
    }
  }

  // 7. Upload final PNG to GCS
  const fileName = `creative-${generationId}-v${version}.png`;
  const file = new File([composited.pngBuffer], fileName, { type: 'image/png' });
  const uploadResult = await uploadCreativeToGCS(file, brandIgId);

  // 8. Store version in DB
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
      cost_usd: totalCost,
    }),
  });

  return { imageUrl: uploadResult.url, direction, qcReport, totalCost };
}
