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
 * Build the prompt for GPT from Claude's direction.
 *
 * The prompt has 4 sections:
 * 1. Moodboard translation (from Claude's analysis)
 * 2. The design brief (from Claude's imageModelPrompt)
 * 3. Text rendering instructions
 * 4. Self-critique checklist (GPT reviews before rendering)
 */
function buildPrompt(direction: CreativeDirection, brandPalette: string[], userOverride?: string): string {
  const d = direction.designDirection;
  const palette = brandPalette.length > 0 ? brandPalette : d.palette.map(c => c.hex);

  // Section 1: Moodboard analysis (Claude's deep reading of the references)
  const moodboardSection = direction.moodboardAnalysis
    ? `MOODBOARD ANALYSIS (from creative director's study of the references):\n${direction.moodboardAnalysis}\n\nYou can also see the moodboard images attached above. Match their design language EXACTLY — not approximately, not "inspired by", but at the SAME level of craft and specificity.\n`
    : '';

  // Section 2: The design brief
  const designBrief = userOverride || direction.imageModelPrompt || '';

  // Section 3: Text to render
  const textBlocks = direction.copy.onImage || [];
  const textLines: string[] = [];
  const roleOrder: Record<string, number> = { headline: 0, body: 1, subtext: 2, cta: 3 };
  const sorted = [...textBlocks].sort((a, b) => (roleOrder[a.role || 'body'] || 1) - (roleOrder[b.role || 'body'] || 1));

  for (const block of sorted) {
    const role = block.role || 'body';
    textLines.push(`"${block.text}" — ${role.toUpperCase()}, ${block.weight || (role === 'headline' ? 'heavy/black' : 'regular')}, ${block.color || '#FFFFFF'}`);
  }
  if (direction.copy.cta && !sorted.find(b => b.role === 'cta')) {
    textLines.push(`"${direction.copy.cta}" — CTA, button/pill element, accent color`);
  }

  // Section 4: Quality standard + design pattern
  const patternDesc: Record<string, string> = {
    'hero-type': 'The headline IS the design — massive type fills 60-70% of the frame',
    'split-canvas': 'Bold color division creating two distinct zones with type in each',
    'editorial': 'Magazine-quality layout with sophisticated type overlay',
    'stat-data': 'A single number/metric dominates, everything else is context',
    'minimal': 'Maximum whitespace, small precise type, stark confidence',
    'collage': 'Layered elements, mixed textures, controlled chaos',
    'poster': 'Full-bleed color with bold typographic hierarchy, street poster energy',
  };
  const pattern = direction.designPattern || 'poster';

  return `Create a production-ready Instagram post (4:5 portrait, 1080×1350).

${moodboardSection}
DESIGN PATTERN: ${patternDesc[pattern] || patternDesc['poster']}

${designBrief}

COLORS: ${d.palette.map(c => `${c.hex} (${c.feel || c.role})`).join(' | ')}

TEXT TO RENDER:
${textLines.join('\n')}

TYPE DIRECTION: ${d.typography || 'Bold sans-serif headlines, light body copy'}

Logo space: ${direction.assets.logo?.position || 'bottom-right'} corner (small, will be added later).

═══ BEFORE YOU RENDER — SELF-CRITIQUE CHECKLIST ═══

Imagine you've created the image. Now review it as a creative director:

1. MOODBOARD MATCH: Does this feel like it belongs in the same world as the reference images? Same level of craft? Same design language? If not, adjust.

2. TEXT QUALITY: Is every single character crisp, perfectly formed, properly kerned? Any garbled or overlapping text? If so, simplify the composition to make text cleaner.

3. HIERARCHY: Can you instantly tell what to read first, second, third? The headline should DOMINATE. If everything is the same size, it fails.

4. INTEGRATION: Does the text feel DESIGNED INTO the composition — or pasted on top? Text and visual should be one unified design, not layers.

5. SCROLL-STOP: Would this actually make someone stop scrolling? If it looks like a template or an AI generated it, it's not good enough. Push it.

6. RESTRAINT: Is every element earning its place? Could you remove something and make it better? Less is almost always more.

Only render when all 6 checks pass. Quality over speed.`;
}

/**
 * Generate a complete Instagram creative using OpenAI Responses API.
 * GPT-4o with image_generation tool — supports input images for style reference.
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
      text: 'MOODBOARD REFERENCES — these define the design world. Study the design patterns, color architecture, typography treatment, and compositional structure. Your output must match this level of craft:',
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
      text: 'BRAND IDENTITY — match this brand\'s color palette and visual language:',
    });
    for (const ref of brandRefs.slice(0, 2)) {
      contentBlocks.push({
        type: 'input_image',
        image_url: `data:${ref.mimeType};base64,${ref.base64}`,
      });
    }
  }

  contentBlocks.push({ type: 'input_text', text: prompt });

  // Use Responses API with image_generation tool
  const response = await (client as any).responses.create({
    model: 'gpt-4o',
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

  // Extract generated image
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
