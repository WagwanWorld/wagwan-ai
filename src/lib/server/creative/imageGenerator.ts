import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
  tokensUsed?: number;
}

/**
 * Generate a BACKGROUND IMAGE using Gemini 2.5 Flash Image.
 *
 * CRITICAL: This generates a text-free background only.
 * All text, logos, and brand elements are composited by Satori afterwards.
 *
 * The prompt must describe the SCENE, not the final post.
 */
export async function generateImage(
  scenePrompt: string,
  options?: {
    styleReferenceBase64?: string;
    styleReferenceMimeType?: string;
    aspectRatio?: string;
    brandPalette?: string[]; // hex colors to enforce
  },
): Promise<ImageGenResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Style reference for brand consistency
  if (options?.styleReferenceBase64) {
    contents.push({
      text: 'STYLE REFERENCE — match this image\'s visual tone, color grading, composition style, and mood:',
    });
    contents.push({
      inlineData: {
        mimeType: options.styleReferenceMimeType || 'image/jpeg',
        data: options.styleReferenceBase64,
      },
    });
  }

  // Build the final prompt — scene-only, no text
  const paletteInstruction = options?.brandPalette?.length
    ? `\nCOLOR PALETTE: Use these brand colors prominently: ${options.brandPalette.join(', ')}`
    : '';

  contents.push({
    text: `Generate a professional background image for a social media post.

SCENE DESCRIPTION:
${scenePrompt}
${paletteInstruction}

ABSOLUTE RULES — VIOLATION MEANS FAILURE:
1. ZERO TEXT in the image. No words, no letters, no numbers, no symbols, no watermarks, no captions.
2. This is a BACKGROUND ONLY. Text and logos will be added in post-production.
3. Leave generous negative space (at least 30% of the image) for text overlay — preferably in the top third and bottom quarter.
4. The image must be clean, professional, and suitable for a brand's Instagram feed.
5. Use the color palette specified above as the dominant tones.
6. High resolution, sharp details, no artifacts, no blur unless intentionally artistic.`,
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
