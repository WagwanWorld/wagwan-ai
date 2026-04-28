import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';
import type { CreativeDirection } from './directionPrompt';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
  tokensUsed?: number;
}

/**
 * Generate a COMPLETE Instagram creative using Gemini 2.5 Flash Image (Nano Banana).
 *
 * Nano Banana handles EVERYTHING: background, text rendering, layout, colors.
 * Only the logo is composited separately (needs pixel-perfect brand mark).
 *
 * The prompt includes:
 * - Scene/visual description from Claude's direction
 * - Brand color palette (hex codes)
 * - ALL on-image text with positioning
 * - Typography style guidance
 * - Up to 3 past post images as style references
 */
export async function generateImage(
  direction: CreativeDirection,
  options?: {
    styleReferences?: Array<{ base64: string; mimeType: string }>;
    aspectRatio?: string;
    brandPalette?: string[];
    userPromptOverride?: string; // if user edited the prompt
  },
): Promise<ImageGenResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Send past post images as style references
  if (options?.styleReferences?.length) {
    contents.push({
      text: 'BRAND STYLE REFERENCES — match the visual identity, color grading, composition, and overall aesthetic of these posts:',
    });
    for (const ref of options.styleReferences.slice(0, 3)) {
      contents.push({
        inlineData: {
          mimeType: ref.mimeType,
          data: ref.base64,
        },
      });
    }
  }

  // Build the complete creative prompt
  const palette = options?.brandPalette?.length
    ? options.brandPalette.join(', ')
    : direction.designDirection.palette.map(c => c.hex).join(', ');

  // Gather ALL text that should appear on the image
  const textBlocks = (direction.copy.onImage || [])
    .map(block => `"${block.text}" — positioned at ${block.position}, ${block.lock ? 'EXACT wording' : 'can style freely'}`)
    .join('\n');

  const ctaText = direction.copy.cta ? `CTA button/text: "${direction.copy.cta}"` : '';

  // Use the user's edited prompt if provided, otherwise build from direction
  const sceneDescription = options?.userPromptOverride || direction.imageModelPrompt || direction.designDirection.imagery;

  contents.push({
    text: `Create a complete, ready-to-post Instagram creative (4:5 portrait, 1080×1350px).

VISUAL SCENE:
${sceneDescription}

BRAND COLOR PALETTE (use these as dominant colors):
${palette}

TYPOGRAPHY & LAYOUT:
${direction.designDirection.typography || 'Clean, modern sans-serif. Bold headlines, lighter body text.'}
Layout: ${direction.designDirection.layout || 'Balanced with clear hierarchy'}

TEXT TO RENDER ON THE IMAGE:
${textBlocks || 'No on-image text specified'}
${ctaText}

DESIGN RULES:
1. This is a FINISHED Instagram post — it must look polished, professional, and high-end.
2. All text must be PERFECTLY LEGIBLE — clean rendering, high contrast against background, no garbled characters.
3. Use the brand colors (${palette}) as the visual foundation — backgrounds, accents, text colors.
4. Match the style of the reference images above — same level of sophistication, same color temperature, same mood.
5. Text hierarchy: headlines are large and bold, supporting text is smaller, CTA stands out.
6. Leave space for a small logo in the ${direction.assets.logo?.position || 'bottom-right'} corner (it will be added separately).
7. Keep the design clean — high-end brand aesthetic, not cluttered or generic.
8. Motifs: ${direction.designDirection.motifs?.join(', ') || 'none specified'}`,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents,
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: (options?.aspectRatio || '4:5') as '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
        tokensUsed: response.usageMetadata?.totalTokenCount,
      };
    }
  }

  throw new Error('Image model returned no image');
}
