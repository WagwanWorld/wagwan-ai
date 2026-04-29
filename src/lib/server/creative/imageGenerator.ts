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
 * Build the creative brief from Claude's direction.
 * Written in visual culture language — vibes, energy, relationships.
 */
function buildCreativeBrief(direction: CreativeDirection, brandPalette: string[], userOverride?: string): string {
  const d = direction.designDirection;

  if (userOverride) {
    return `${userOverride}

${buildTextInfo(direction)}

This is a finished, production-ready Instagram post. Senior designer quality.`;
  }

  const palette = brandPalette.length > 0 ? brandPalette : d.palette.map(c => c.hex);
  const colorDescriptions = d.palette.map(c => `${c.hex} (${c.feel || c.role})`).join(', ');

  const sections: string[] = [];

  if (d.vibe) sections.push(`VIBE: ${d.vibe}`);
  if (d.references) sections.push(`STYLE: ${d.references}`);

  sections.push(`DESIGN:\n${d.layout}\n${d.visualElements || ''}\n${d.imagery || ''}`);
  sections.push(`COLORS: ${colorDescriptions}\nFull palette: ${palette.join(', ')}`);
  sections.push(`TYPE:\n${d.typography}`);
  sections.push(buildTextInfo(direction));
  sections.push(`This must look like it was crafted by a senior designer — not generated. Every element intentional. Leave space in ${direction.assets.logo?.position || 'bottom-right'} for a logo.`);

  return sections.join('\n\n');
}

function buildTextInfo(direction: CreativeDirection): string {
  const textBlocks = direction.copy.onImage || [];
  if (textBlocks.length === 0 && !direction.copy.cta) return '';

  const lines: string[] = ['TEXT TO RENDER:'];
  const roleOrder: Record<string, number> = { headline: 0, body: 1, subtext: 2, cta: 3 };
  const sorted = [...textBlocks].sort((a, b) => (roleOrder[a.role || 'body'] || 1) - (roleOrder[b.role || 'body'] || 1));

  for (const block of sorted) {
    const role = block.role || 'body';
    lines.push(`• [${role.toUpperCase()}] "${block.text}" — ${block.weight || (role === 'headline' ? 'bold/heavy' : 'regular')}, ${block.color || '#FFFFFF'}`);
  }

  if (direction.copy.cta && !sorted.find(b => b.role === 'cta')) {
    lines.push(`• [CTA] "${direction.copy.cta}" — distinct button/pill element, accent color`);
  }

  lines.push('\nEvery character must be PERFECTLY rendered — crisp, clean, zero artifacts. Text hierarchy must be instantly clear.');
  return lines.join('\n');
}

/**
 * Generate a complete Instagram creative using OpenAI gpt-image-1.
 *
 * Why OpenAI over Gemini:
 * - Significantly better text rendering (designed for accurate typography)
 * - Better at following detailed design briefs
 * - Cleaner, more production-ready output
 *
 * Pricing: ~$0.07/image (medium quality) or ~$0.19/image (high quality)
 * vs Gemini at ~$0.04/image but with worse text quality
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

  // Build the creative brief
  const brief = buildCreativeBrief(
    direction,
    options?.brandPalette || [],
    options?.userPromptOverride,
  );

  // Build the full prompt with moodboard context described in text
  // (OpenAI images.generate doesn't accept reference images directly)
  let fullPrompt = `Create a finished Instagram post (4:5 portrait, 1080×1350px).\n\n`;

  // Describe moodboard references in text since we can't pass images
  if (options?.styleReferences?.length) {
    const moodboardRefs = options.styleReferences.filter(r => r.source === 'moodboard');
    if (moodboardRefs.length > 0) {
      fullPrompt += `DESIGN STYLE: Match the aesthetic of high-end social media design — clean typography, bold color blocking, intentional composition. Think top-tier design agency output.\n\n`;
    }
  }

  fullPrompt += brief;

  const quality = options?.quality || 'medium';

  const result = await client.images.generate({
    model: 'gpt-image-1',
    prompt: fullPrompt,
    size: '1024x1536', // closest to 4:5 (actually 2:3, slightly taller)
    quality,
    response_format: 'b64_json',
  });

  const imageData = result.data[0]?.b64_json;
  if (!imageData) throw new Error('OpenAI returned no image');

  return {
    base64: imageData,
    mimeType: 'image/png',
    model: 'gpt-image-1',
    quality,
  };
}
