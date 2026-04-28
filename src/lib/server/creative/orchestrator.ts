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

export async function generateVisual(input: GenerateVisualInput): Promise<GenerateVisualResult> {
  const { brandIgId, copy, caption, lockedPhrases, brief, generationId, version } = input;
  let totalCost = 0;

  // 1. Get creative context + thumbnails
  const context = await getOrBuildCreativeContext(brandIgId);
  const thumbnails = await getRecentThumbnails(brandIgId, 5);

  // 2. Fetch brand logo
  const supabaseUrl = env.SUPABASE_URL!;
  const logoRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${brandIgId}&type=eq.logo_primary&is_default=eq.true&limit=1`,
    { headers: supaHeaders() },
  );
  const logos = logoRes.ok ? await logoRes.json() : [];
  const logoUrl = logos[0]?.url || null;

  // 3. Call Claude Sonnet for creative direction
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });

  const directionParts: Anthropic.Messages.ContentBlockParam[] = [];

  // Add thumbnail references
  for (let i = 0; i < Math.min(thumbnails.length, 3); i++) {
    try {
      const imgRes = await fetch(thumbnails[i]);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        directionParts.push({ type: 'text', text: `Past post ${i + 1} (reference style):` });
        directionParts.push({
          type: 'image',
          source: { type: 'base64', media_type: contentType as 'image/jpeg', data: base64 },
        });
      }
    } catch { /* skip failed thumbnail */ }
  }

  // Mark locked phrases in copy
  let processedCopy = copy;
  if (lockedPhrases?.length) {
    processedCopy += `\n\nLOCKED PHRASES (must be composited exactly, not AI-rendered): ${lockedPhrases.join(', ')}`;
  }

  directionParts.push({
    type: 'text',
    text: `BRAND CREATIVE CONTEXT:
${JSON.stringify(context.visual_identity, null, 2)}

VOICE PROFILE:
${JSON.stringify(context.voice_profile, null, 2)}

${context.learned_preferences.revision_patterns_summary ? `LEARNED PREFERENCES: ${context.learned_preferences.revision_patterns_summary}` : ''}

COPY TO DESIGN FOR:
${processedCopy}

${caption ? `SUGGESTED CAPTION: ${caption}` : ''}
${brief ? `ORIGINAL BRIEF: ${brief}` : ''}

Format: static 4:5 (1080x1350)
${logoUrl ? 'Brand logo is available and will be composited separately.' : 'No logo uploaded — use text-mark if appropriate.'}

${DIRECTION_OUTPUT_SCHEMA}`,
  });

  const directionResponse = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: CREATIVE_DIRECTOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: directionParts }],
  });

  const directionText = directionResponse.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let direction: CreativeDirection;
  try {
    const cleaned = directionText.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    direction = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid direction JSON: ${directionText.slice(0, 200)}`);
  }

  const dirCost = ((directionResponse.usage?.input_tokens || 0) * 3 + (directionResponse.usage?.output_tokens || 0) * 15) / 1_000_000;
  totalCost += dirCost;
  await logCost(brandIgId, generationId, 'direction', 'claude-sonnet-4-20250514', directionResponse.usage?.input_tokens || 0, directionResponse.usage?.output_tokens || 0, dirCost);

  // 4. Generate image via Gemini
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

  const imageResult = await generateImage(direction.imageModelPrompt, {
    styleReferenceBase64: styleRefBase64,
    aspectRatio: '4:5',
  });

  const imgCost = 0.04; // estimated per image
  totalCost += imgCost;
  await logCost(brandIgId, generationId, 'image_generation', 'gemini-2.5-flash-image', 0, 0, imgCost, 1);

  // 5. Composite brand overlay
  const composited = await compositeImage({
    backgroundBase64: imageResult.base64,
    backgroundMimeType: imageResult.mimeType,
    direction,
    logoUrl: logoUrl || undefined,
    brandColors: direction.designDirection.palette,
  });

  // 6. Run QC
  const compositedBase64 = composited.pngBuffer.toString('base64');
  const paletteHexes = direction.designDirection.palette.map((c) => c.hex);
  const qcReport = await runQC(compositedBase64, 'image/png', paletteHexes, direction.assets.logo.position);

  const qcCost = 0.003;
  totalCost += qcCost;
  await logCost(brandIgId, generationId, 'qc', 'claude-haiku-4-5-20251001', 0, 0, qcCost);

  // 7. If QC fails, retry once
  if (!qcReport.passed) {
    const retryImage = await generateImage(
      direction.imageModelPrompt + '\n\nIMPORTANT: Ensure text is clearly legible, well-positioned, and not overlapping. Use high contrast between text and background.',
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

    totalCost += imgCost + qcCost;

    // Use retry result regardless
    Object.assign(qcReport, retryQc);
    composited.pngBuffer = retryComposited.pngBuffer;
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
