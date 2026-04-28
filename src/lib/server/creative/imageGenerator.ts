import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
  tokensUsed?: number;
}

/**
 * Generate an image using Gemini 2.5 Flash Image (Nano Banana).
 *
 * Cost optimization:
 * - IMAGE-only response modality (skip TEXT output — saves output tokens)
 * - Narrative prompt structure (Gemini performs better with scene descriptions vs keyword lists)
 * - Single style reference max (more refs = more input tokens with diminishing returns)
 * - 4:5 aspect ratio at native 1024px (upscaled to 1080x1350 by compositor)
 *
 * Pricing: ~$0.039/image (1,290 output tokens × $30/M) + input tokens at $0.30/M
 */
export async function generateImage(
  prompt: string,
  options?: {
    styleReferenceBase64?: string;
    styleReferenceMimeType?: string;
    aspectRatio?: string;
  },
): Promise<ImageGenResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Single style reference only — more refs increase cost without proportional quality gain
  if (options?.styleReferenceBase64) {
    contents.push({
      text: 'Match the visual style, color palette, and composition of this reference image:',
    });
    contents.push({
      inlineData: {
        mimeType: options.styleReferenceMimeType || 'image/jpeg',
        data: options.styleReferenceBase64,
      },
    });
  }

  // Narrative prompt with explicit quality anchors — Gemini responds better to
  // scene descriptions than keyword lists
  contents.push({
    text: `Create a high-quality Instagram post image (4:5 portrait format).

${prompt}

IMPORTANT RULES:
- Do NOT render any text, words, letters, or numbers in the image — all text will be added separately
- Focus on creating a clean, professional background composition
- Leave clear negative space where text can be overlaid (top third or center)
- Use high contrast between foreground and background elements
- Ensure the image works as a social media post at mobile resolution`,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents,
    config: {
      // IMAGE-only modality saves output tokens (no text generation cost)
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: (options?.aspectRatio || '4:5') as '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
      },
    },
  });

  // Extract image from response
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
