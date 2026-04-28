import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
}

/**
 * Generate an image using Gemini 2.5 Flash Image (Nano Banana).
 * Supports optional style reference image for brand consistency.
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

  // Add style reference if provided
  if (options?.styleReferenceBase64) {
    contents.push({ text: 'Use the following image as a style reference. Match its visual tone, color palette, and composition style:' });
    contents.push({
      inlineData: {
        mimeType: options.styleReferenceMimeType || 'image/jpeg',
        data: options.styleReferenceBase64,
      },
    });
  }

  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-05-20',
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
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
      };
    }
  }

  throw new Error('Image model returned no image');
}
