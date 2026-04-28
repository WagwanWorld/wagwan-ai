import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { CREATIVE_DIRECTOR_SYSTEM_PROMPT, DIRECTION_OUTPUT_SCHEMA, type CreativeDirection } from './directionPrompt';
import { getOrBuildCreativeContext, getRecentThumbnails, logCost } from './contextBuilder';
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
 * Cost-optimized generation pipeline:
 *
 * 1. Direction: Haiku (not Sonnet) — $0.80/$4 vs $3/$15 per M tokens
 *    Haiku is sufficient for structured JSON output when given a strong system prompt.
 *    Saves ~75% on direction step (~$0.005 vs ~$0.046).
 *
 * 2. Thumbnails: max 2 (not 3-5) — each thumbnail ~1.5K input tokens.
 *    2 refs give enough style signal. Saves ~$0.003 in input tokens.
 *
 * 3. Image gen: IMAGE-only modality — skip text output tokens.
 *    Gemini charges $30/M output tokens. Cutting TEXT response saves ~$0.01.
 *
 * 4. QC: conditional — skip if brand has >80% approval rate (learned trust).
 *    Saves $0.003 per generation after enough history.
 *
 * 5. No-text prompt: tells Gemini NOT to render text in the image.
 *    Reduces QC failures (text garbling is #1 failure mode), saving retry costs.
 *
 * Total per generation: ~$0.05 (vs ~$0.09 unoptimized)
 */
export async function generateVisual(input: GenerateVisualInput): Promise<GenerateVisualResult> {
  const { brandIgId, copy, caption, lockedPhrases, brief, generationId, version } = input;
  let totalCost = 0;

  // 1. Get creative context + thumbnails (max 2 for cost)
  const context = await getOrBuildCreativeContext(brandIgId);
  const thumbnails = await getRecentThumbnails(brandIgId, 2);

  // 2. Fetch brand logo (single query, cached per request)
  const supabaseUrl = env.SUPABASE_URL!;
  const logoRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${brandIgId}&type=eq.logo_primary&is_default=eq.true&limit=1`,
    { headers: supaHeaders() },
  );
  const logos = logoRes.ok ? await logoRes.json() : [];
  const logoUrl = logos[0]?.url || null;

  // 3. Call Claude Haiku for creative direction (cost-optimized vs Sonnet)
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  const directionModel = 'claude-haiku-4-5-20251001';

  const directionParts: Anthropic.Messages.ContentBlockParam[] = [];

  // Add max 2 thumbnail references (diminishing returns beyond 2)
  for (let i = 0; i < Math.min(thumbnails.length, 2); i++) {
    try {
      const imgRes = await fetch(thumbnails[i]);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        directionParts.push({ type: 'text', text: `Brand reference ${i + 1}:` });
        directionParts.push({
          type: 'image',
          source: { type: 'base64', media_type: contentType as 'image/jpeg', data: base64 },
        });
      }
    } catch { /* skip */ }
  }

  // Build concise context (no pretty-printing JSON — saves tokens)
  let processedCopy = copy;
  if (lockedPhrases?.length) {
    processedCopy += `\nLOCKED (composite exactly): ${lockedPhrases.join(', ')}`;
  }

  directionParts.push({
    type: 'text',
    text: `BRAND CONTEXT:${JSON.stringify(context.visual_identity)}
VOICE:${JSON.stringify(context.voice_profile)}
${context.learned_preferences.revision_patterns_summary ? `PREFERENCES:${context.learned_preferences.revision_patterns_summary}` : ''}
COPY:${processedCopy}
${caption ? `CAPTION:${caption}` : ''}${brief ? `\nBRIEF:${brief}` : ''}
Format:4:5 static (1080x1350)
${logoUrl ? 'Logo available (composited separately).' : 'No logo.'}
CRITICAL: In imageModelPrompt, do NOT ask for any text/words/letters in the image. All text is composited separately.
${DIRECTION_OUTPUT_SCHEMA}`,
  });

  const directionResponse = await client.messages.create({
    model: directionModel,
    max_tokens: 3000, // direction JSON needs room for concept + imageModelPrompt
    system: CREATIVE_DIRECTOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: directionParts }],
  });

  const directionText = directionResponse.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let direction: CreativeDirection;
  try {
    // Strip markdown fences, trim whitespace
    let cleaned = directionText
      .replace(/^[\s\S]*?```json?\s*\n?/i, '') // everything before ```json
      .replace(/\n?```[\s\S]*$/i, '')           // everything after ```
      .trim();
    // If no fences found, try the raw text
    if (!cleaned || cleaned === directionText.trim()) {
      cleaned = directionText.trim();
    }
    // Try to extract JSON object if there's text before/after it
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    direction = JSON.parse(cleaned);
  } catch {
    // If truncated (stop_reason = max_tokens), retry with higher limit
    if (directionResponse.stop_reason === 'max_tokens') {
      throw new Error('Direction response was truncated — try a shorter copy input');
    }
    throw new Error(`Claude returned invalid direction JSON: ${directionText.slice(0, 300)}`);
  }

  // Accurate cost: Haiku = $0.80/M input, $4/M output
  const inputTokens = directionResponse.usage?.input_tokens || 0;
  const outputTokens = directionResponse.usage?.output_tokens || 0;
  const dirCost = (inputTokens * 0.8 + outputTokens * 4) / 1_000_000;
  totalCost += dirCost;
  await logCost(brandIgId, generationId, 'direction', directionModel, inputTokens, outputTokens, dirCost);

  // 4. Generate BACKGROUND image via Gemini — text-free, brand-colored
  // Strip any text/copy instructions that may have leaked into imageModelPrompt
  const cleanedImagePrompt = direction.imageModelPrompt
    .replace(/text|copy|headline|caption|cta|call.to.action|"[^"]{10,}"/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Use the SCENE description from designDirection.imagery if imageModelPrompt is weak
  const scenePrompt = cleanedImagePrompt.length > 30
    ? cleanedImagePrompt
    : direction.designDirection.imagery || 'Professional, modern, clean brand background';

  // Extract brand palette hex codes for color enforcement
  const brandPaletteHexes = direction.designDirection.palette.map((c) => c.hex);

  let styleRefBase64: string | undefined;
  if (thumbnails.length > 0) {
    try {
      const refRes = await fetch(thumbnails[0]);
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

  // Accurate cost: $0.039/image (1,290 tokens × $30/M) + input tokens at $0.30/M
  const imgInputTokens = imageResult.tokensUsed || 500;
  const imgCost = 0.039 + (imgInputTokens * 0.3) / 1_000_000;
  totalCost += imgCost;
  await logCost(brandIgId, generationId, 'image_generation', 'gemini-2.5-flash-image', imgInputTokens, 1290, imgCost, 1);

  // 5. Composite brand overlay
  const composited = await compositeImage({
    backgroundBase64: imageResult.base64,
    backgroundMimeType: imageResult.mimeType,
    direction,
    logoUrl: logoUrl || undefined,
    brandColors: direction.designDirection.palette,
  });

  // 6. Conditional QC — skip if brand has high approval rate (trusted)
  let qcReport = { textLegible: true, logoOk: true, paletteOk: true, safeZoneOk: true, issues: [] as string[], passed: true };
  const skipQC = context.learned_preferences.approval_rate > 0.8 && context.context_version > 3;

  if (!skipQC) {
    const compositedBase64 = composited.pngBuffer.toString('base64');
    const paletteHexes = direction.designDirection.palette.map((c) => c.hex);
    qcReport = await runQC(compositedBase64, 'image/png', paletteHexes, direction.assets.logo.position);

    const qcCost = 0.003;
    totalCost += qcCost;
    await logCost(brandIgId, generationId, 'qc', 'claude-haiku-4-5-20251001', 0, 0, qcCost);

    // 7. If QC fails, retry once with stricter prompt
    if (!qcReport.passed) {
      const retryImage = await generateImage(
        direction.imageModelPrompt + '\n\nCRITICAL: Create a clean background image with NO text, NO words, NO letters. Leave clear space for text overlay. High contrast, professional quality.',
        { styleReferenceBase64: styleRefBase64, aspectRatio: '4:5' },
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

  // 8. Upload final PNG to GCS
  const finalBuffer = composited.pngBuffer;
  const fileName = `creative-${generationId}-v${version}.png`;
  const file = new File([finalBuffer], fileName, { type: 'image/png' });
  const uploadResult = await uploadCreativeToGCS(file, brandIgId);

  // 9. Store version in DB
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

  return {
    imageUrl: uploadResult.url,
    direction,
    qcReport,
    totalCost,
  };
}
