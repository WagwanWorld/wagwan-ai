import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';
import type { CreativeDirection } from './directionPrompt';

export interface ImageGenResult {
  base64: string;
  mimeType: string;
  tokensUsed?: number;
}

/**
 * Build the Gemini prompt from Claude's direction.
 * Written in creative director language, not CSS specifications.
 */
function buildCreativeBrief(direction: CreativeDirection, brandPalette: string[], userOverride?: string): string {
  const d = direction.designDirection;

  // If user edited the prompt, use theirs + append text info
  if (userOverride) {
    const textInfo = buildTextInfo(direction);
    return `${userOverride}

${textInfo}

Render this as a finished, scroll-stopping Instagram post. Production quality. Would make a creative director proud.`;
  }

  const palette = brandPalette.length > 0 ? brandPalette : d.palette.map(c => c.hex);
  const colorDescriptions = d.palette.map(c => `${c.hex} (${c.feel || c.role})`).join(', ');

  const sections: string[] = [];

  // THE VIBE — sets the emotional context
  if (d.vibe) {
    sections.push(`VIBE: ${d.vibe}`);
  }

  // VISUAL REFERENCES — tie to culture
  if (d.references) {
    sections.push(`STYLE REFERENCE: ${d.references}`);
  }

  // THE DESIGN — spatial and relational, not pixel-measured
  sections.push(`DESIGN:
${d.layout}

${d.visualElements ? `GRAPHIC ELEMENTS: ${d.visualElements}` : ''}
${d.imagery || ''}`);

  // COLOR — emotional, not just hex codes
  sections.push(`COLOR WORLD: ${colorDescriptions}
Full palette: ${palette.join(', ')}
Use color as ARCHITECTURE — big bold fields, not subtle tints. The colors should hit you.`);

  // TYPE — as character, not specs
  sections.push(`TYPOGRAPHY:
${d.typography}

The type is not decoration — it IS the design. Render every letter with precision and intention.`);

  // THE TEXT TO RENDER
  sections.push(buildTextInfo(direction));

  // THE STANDARD
  sections.push(`QUALITY:
This is a finished Instagram post for a real brand. It must look like a human designer crafted it with intention — not like an AI generated it.
${d.approach === 'typographic' ? 'This is a TYPOGRAPHIC design — the text creates the visual impact. No photography needed.' : ''}
Match the moodboard references above in craft quality and design sophistication.
Would a creative director post this? If not, it's not done.

Leave a small space in the ${direction.assets.logo?.position || 'bottom-right'} for a logo mark.`);

  return sections.join('\n\n');
}

/**
 * Build text information — what Gemini needs to render.
 * Described in relational terms, not pixel specs.
 */
function buildTextInfo(direction: CreativeDirection): string {
  const textBlocks = direction.copy.onImage || [];
  if (textBlocks.length === 0 && !direction.copy.cta) {
    return 'No on-image text — purely visual.';
  }

  const lines: string[] = ['TEXT TO RENDER:'];

  const roleOrder: Record<string, number> = { headline: 0, body: 1, subtext: 2, cta: 3 };
  const sorted = [...textBlocks].sort((a, b) => (roleOrder[a.role || 'body'] || 1) - (roleOrder[b.role || 'body'] || 1));

  for (const block of sorted) {
    const role = block.role || 'body';
    const sizeDesc: Record<string, string> = {
      massive: 'DOMINANT — the biggest thing on the canvas, impossible to miss',
      large: 'Prominent — commands attention but shares the frame',
      medium: 'Supporting — clearly secondary, anchors the composition',
      small: 'Quiet — almost whispered, fine print energy',
    };

    lines.push(`• [${role.toUpperCase()}] "${block.text}"
  ${sizeDesc[block.size || 'large'] || sizeDesc['medium']}
  ${block.weight || (role === 'headline' ? 'Heavy/black weight' : 'Regular weight')}
  Color: ${block.color || '#FFFFFF'}`);
  }

  if (direction.copy.cta && !sorted.find(b => b.role === 'cta')) {
    lines.push(`• [CTA] "${direction.copy.cta}"
  A distinct call-to-action element — pill button, underlined text, or bold standalone line
  Accent color, stands out from body text`);
  }

  lines.push(`
Every character must be PERFECTLY rendered — crisp, clean, no artifacts.
Text hierarchy must be instantly clear: what's the headline? what's supporting? what's the action?`);

  return lines.join('\n');
}

/**
 * Generate the complete Instagram creative via Gemini 2.5 Flash Image.
 */
export async function generateImage(
  direction: CreativeDirection,
  options?: {
    styleReferences?: Array<{ base64: string; mimeType: string; source?: 'moodboard' | 'brand-post' }>;
    aspectRatio?: string;
    brandPalette?: string[];
    userPromptOverride?: string;
  },
): Promise<ImageGenResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });
  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // MOODBOARD — defines the visual world
  if (options?.styleReferences?.length) {
    const moodboardRefs = options.styleReferences.filter(r => r.source === 'moodboard');
    const brandPostRefs = options.styleReferences.filter(r => r.source !== 'moodboard');

    if (moodboardRefs.length > 0) {
      contents.push({
        text: `MOODBOARD — this is the visual world we're designing in. Study these references:
• Their energy and emotional tone
• How they handle type — size, weight, placement, integration with visuals
• Their color language — bold fields? subtle gradients? monochrome?
• The level of craft — details, precision, intentionality
• How photography/graphics relate to text (or if it's pure typography)

CREATE SOMETHING THAT BELONGS IN THIS WORLD:`,
      });
      for (const ref of moodboardRefs.slice(0, 4)) {
        contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }
    }

    if (brandPostRefs.length > 0) {
      contents.push({
        text: 'BRAND FEED — match this brand\'s identity and color palette:',
      });
      for (const ref of brandPostRefs.slice(0, 2)) {
        contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }
    }
  }

  // The creative brief
  contents.push({
    text: `Create a finished Instagram post (4:5, 1080×1350px).

${buildCreativeBrief(direction, options?.brandPalette || [], options?.userPromptOverride)}`,
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
