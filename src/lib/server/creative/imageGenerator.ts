import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { CreativeDirection } from './directionPrompt';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
  model: string;
  quality: string;
}

/**
 * Build the text prompt for OpenAI from Claude's direction.
 */
function buildPrompt(direction: CreativeDirection, brandPalette: string[], userOverride?: string): string {
  const d = direction.designDirection;
  const palette = brandPalette.length > 0 ? brandPalette : d.palette.map(c => c.hex);

  const designBrief = userOverride || direction.imageModelPrompt || '';

  // Text rendering block
  const textBlocks = direction.copy.onImage || [];
  const textLines: string[] = [];
  const roleOrder: Record<string, number> = { headline: 0, body: 1, subtext: 2, cta: 3 };
  const sorted = [...textBlocks].sort((a, b) => (roleOrder[a.role || 'body'] || 1) - (roleOrder[b.role || 'body'] || 1));

  for (const block of sorted) {
    const role = block.role || 'body';
    const sizeDesc = role === 'headline' ? 'LARGE and DOMINANT — the focal point'
      : role === 'cta' ? 'medium, inside a distinct button element'
      : 'smaller, supporting — secondary to headline';
    textLines.push(`"${block.text}" — ${role.toUpperCase()}, ${sizeDesc}, ${block.weight || 'bold'}, ${block.color || '#FFFFFF'}`);
  }

  if (direction.copy.cta && !sorted.find(b => b.role === 'cta')) {
    textLines.push(`"${direction.copy.cta}" — CTA, pill button or bold standalone, accent color`);
  }

  return `Create a production-ready Instagram post (4:5 portrait format).

${designBrief}

COLORS: ${palette.join(', ')}
${d.palette.map(c => `${c.hex} = ${c.feel || c.role}`).join(', ')}

TEXT TO RENDER:
${textLines.join('\n')}

TYPOGRAPHY:
- Every letter CRISP and PERFECTLY formed
- Clear hierarchy: headline dominates, body supports, CTA stands out
- Text DESIGNED INTO the composition — integrated, not overlaid
- ${d.typography || 'Bold sans-serif headlines, lighter body'}

QUALITY: Senior designer at a top agency made this. Crafted, intentional, confident. Not a template.

Logo space: ${direction.assets.logo?.position || 'bottom-right'} corner.`;
}

/**
 * Generate a complete Instagram creative using OpenAI Responses API
 * with gpt-image-1 tool — supports INPUT IMAGES for style reference.
 *
 * This is the key advantage over images.generate():
 * We can pass moodboard images directly so GPT sees them while generating.
 */
export async function generateImage(
  direction: CreativeDirection,
  options?: {
    styleReferences?: Array<{ base64: string; mimeType: string; source?: 'moodboard' | 'brand-post' }>;
    aspectRatio?: string;
    brandPalette?: string[];
    userPromptOverride?: string;
    quality?: 'low' | 'medium' | 'high';
  },
): Promise<ImageGenResult> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const client = new OpenAI({ apiKey });

  const prompt = buildPrompt(
    direction,
    options?.brandPalette || [],
    options?.userPromptOverride,
  );

  const quality = options?.quality || 'high';

  // Build content blocks with reference images
  const contentBlocks: Array<{ type: string; text?: string; image_url?: string }> = [];

  const refs = options?.styleReferences || [];
  const moodboardRefs = refs.filter(r => r.source === 'moodboard');
  const brandRefs = refs.filter(r => r.source === 'brand-post');

  if (moodboardRefs.length > 0) {
    contentBlocks.push({
      type: 'input_text',
      text: 'MOODBOARD — match this exact visual style, composition, color language, and craft quality:',
    });
    for (const ref of moodboardRefs.slice(0, 3)) {
      contentBlocks.push({
        type: 'input_image',
        image_url: `data:${ref.mimeType};base64,${ref.base64}`,
      });
    }
  }

  if (brandRefs.length > 0) {
    contentBlocks.push({
      type: 'input_text',
      text: 'BRAND IDENTITY — match this brand\'s color palette and visual identity:',
    });
    for (const ref of brandRefs.slice(0, 2)) {
      contentBlocks.push({
        type: 'input_image',
        image_url: `data:${ref.mimeType};base64,${ref.base64}`,
      });
    }
  }

  contentBlocks.push({ type: 'input_text', text: prompt });

  // Use Responses API with image_generation tool — supports input images
  const response = await (client as any).responses.create({
    model: 'gpt-4o-mini',
    input: [{
      role: 'user',
      content: contentBlocks,
    }],
    tools: [{
      type: 'image_generation',
      quality,
      size: '1024x1536',
    }],
  });

  // Extract generated image from response output
  const outputs = response.output || [];
  const imageOutput = outputs.find(
    (o: Record<string, unknown>) => o.type === 'image_generation_call'
  ) as { type: string; result: string } | undefined;

  if (!imageOutput?.result) {
    throw new Error('OpenAI returned no image');
  }

  return {
    base64: imageOutput.result,
    mimeType: 'image/png',
    model: 'gpt-image-1',
    quality,
  };
}
