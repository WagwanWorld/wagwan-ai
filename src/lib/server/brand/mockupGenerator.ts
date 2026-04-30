/**
 * Brand mockup image generator.
 * Uses GPT-4o image generation to create branded application mockups
 * (IG post, business card, website header, social banner) and uploads to GCS.
 */
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import { uploadCreativeToGCS } from '$lib/server/marketplace/gcsUpload';
import type { BrandScheme } from '$lib/types/brand-os';

interface MockupResult {
  description: string;
  imageUrl?: string;
}

interface MockupSet {
  igPost: MockupResult;
  businessCard: MockupResult;
  websiteHeader: MockupResult;
  socialBanner: MockupResult;
}

const MOCKUP_CONFIGS = [
  {
    key: 'igPost' as const,
    label: 'Instagram Post',
    size: '1024x1024' as const,
    promptTemplate: (brand: string, palette: string, fonts: string, tagline: string) =>
      `Create a professional Instagram post mockup for the brand "${brand}". ${tagline ? `Tagline: "${tagline}".` : ''} Use this exact color palette: ${palette}. Typography: ${fonts}. Design a visually striking branded post that showcases the brand identity — bold, clean, premium. Include the brand name "${brand}" as text. No placeholder text like "lorem ipsum". This should look like a real, polished Instagram post from a professional brand.`,
  },
  {
    key: 'businessCard' as const,
    label: 'Business Card',
    size: '1536x1024' as const,
    promptTemplate: (brand: string, palette: string, fonts: string, tagline: string) =>
      `Create a professional business card mockup for the brand "${brand}". ${tagline ? `Tagline: "${tagline}".` : ''} Use this exact color palette: ${palette}. Typography: ${fonts}. Show both front and back of the card side by side on a dark surface. The card should be minimal, modern, and premium — include the brand name, a placeholder name "Jane Smith", title "Founder", and a website URL. No gradients unless they're in the brand palette. Photorealistic 3D render with subtle shadows.`,
  },
  {
    key: 'websiteHeader' as const,
    label: 'Website Header',
    size: '1536x1024' as const,
    promptTemplate: (brand: string, palette: string, fonts: string, tagline: string) =>
      `Create a website header/hero section mockup for the brand "${brand}". ${tagline ? `The hero text reads: "${tagline}".` : ''} Use this exact color palette: ${palette}. Typography: ${fonts}. Show a browser window with the website header section — navigation bar with the brand name, hero section with headline text, and a call-to-action button. Modern, clean UI design. The mockup should look like a real website screenshot, not a wireframe.`,
  },
  {
    key: 'socialBanner' as const,
    label: 'Social Media Banner',
    size: '1536x1024' as const,
    promptTemplate: (brand: string, palette: string, fonts: string, tagline: string) =>
      `Create a social media cover/banner mockup for the brand "${brand}". ${tagline ? `Include the text: "${tagline}".` : ''} Use this exact color palette: ${palette}. Typography: ${fonts}. Wide banner format suitable for Twitter/LinkedIn header. The design should be bold, branded, and visually striking — use the brand colors prominently. Include the brand name. Clean, professional, high-end design agency quality.`,
  },
];

/**
 * Generate all 4 brand application mockups using GPT-4o image generation.
 * Each mockup is generated, uploaded to GCS, and the URL is returned.
 */
export async function generateBrandMockups(
  brandScheme: BrandScheme,
  brandName: string,
  brandIgId: string,
): Promise<MockupSet> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const client = new OpenAI({ apiKey });

  // Build context strings from the brand scheme
  const palette = brandScheme.palette
    .map((c) => `${c.name} (${c.hex}, ${c.role})`)
    .join(', ');
  const fonts = `Heading: ${brandScheme.typography.heading.family}, Body: ${brandScheme.typography.body.family}`;
  const tagline = brandScheme.tagline || '';

  // Generate all 4 mockups in parallel
  const results = await Promise.allSettled(
    MOCKUP_CONFIGS.map(async (config) => {
      const prompt = config.promptTemplate(brandName, palette, fonts, tagline);

      try {
        console.log(`[mockupGenerator] Generating ${config.label} for ${brandName}`);

        const response = await (client as any).responses.create({
          model: 'gpt-4o',
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: prompt }],
            },
          ],
          tools: [
            {
              type: 'image_generation',
              quality: 'medium',
              size: config.size,
            },
          ],
        });

        const outputs = response.output || [];
        const imageOutput = outputs.find(
          (o: Record<string, unknown>) => o.type === 'image_generation_call',
        ) as { type: string; result: string } | undefined;

        if (!imageOutput?.result) {
          console.warn(`[mockupGenerator] No image returned for ${config.label}`);
          return { key: config.key, description: prompt, imageUrl: undefined };
        }

        // Upload to GCS
        const buffer = Buffer.from(imageOutput.result, 'base64');
        const fileName = `brand-mockup-${config.key}-${Date.now()}.png`;
        const file = new File([buffer], fileName, { type: 'image/png' });
        const upload = await uploadCreativeToGCS(file, brandIgId);

        console.log(`[mockupGenerator] Uploaded ${config.label}: ${upload.url}`);
        return { key: config.key, description: prompt, imageUrl: upload.url };
      } catch (err) {
        console.error(`[mockupGenerator] Failed to generate ${config.label}:`, err);
        return { key: config.key, description: `${config.label} mockup`, imageUrl: undefined };
      }
    }),
  );

  const mockups: MockupSet = {
    igPost: { description: 'Instagram post mockup' },
    businessCard: { description: 'Business card mockup' },
    websiteHeader: { description: 'Website header mockup' },
    socialBanner: { description: 'Social banner mockup' },
  };

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { key, description, imageUrl } = result.value;
      mockups[key] = { description, imageUrl };
    }
  }

  return mockups;
}
