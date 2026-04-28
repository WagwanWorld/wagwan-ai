import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { env } from '$env/dynamic/private';
import type { CreativeDirection } from './directionPrompt';

export interface CompositeOptions {
  backgroundBase64: string;
  backgroundMimeType: string;
  direction: CreativeDirection;
  logoUrl?: string;
  brandColors: { hex: string; role: string }[];
  width?: number;
  height?: number;
}

export interface CompositeResult {
  pngBuffer: Buffer;
  width: number;
  height: number;
}

/**
 * Overlay brand elements (logo, locked text, CTA) onto the AI-generated background.
 * Uses Satori to render an HTML/CSS layout to SVG, then resvg to rasterize to PNG.
 */
export async function compositeImage(options: CompositeOptions): Promise<CompositeResult> {
  const { backgroundBase64, backgroundMimeType, direction, logoUrl, brandColors } = options;
  const width = options.width || 1080;
  const height = options.height || 1350; // 4:5

  // Load a fallback font (Inter) for Satori — must have at least one font
  const fontRes = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff');
  const fontBuffer = await fontRes.arrayBuffer();

  const fontBoldRes = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff');
  const fontBoldBuffer = await fontBoldRes.arrayBuffer();

  // Build overlay elements from direction
  const bgColor = brandColors.find((c) => c.role === 'background')?.hex || '#000000';
  const textColor = brandColors.find((c) => c.role === 'text')?.hex || '#FFFFFF';
  const accentColor = brandColors.find((c) => c.role === 'accent')?.hex || brandColors[0]?.hex || '#FFFFFF';

  // Determine logo position
  const logoPos = direction.assets.logo.position || 'bottom-right';
  const logoStyle: Record<string, string> = { position: 'absolute', width: '80px', height: 'auto' };
  if (logoPos.includes('bottom')) logoStyle.bottom = '40px';
  else logoStyle.top = '40px';
  if (logoPos.includes('right')) logoStyle.right = '40px';
  else logoStyle.left = '40px';

  // Build locked text elements
  const lockedTexts = [...(direction.assets.locked || []), ...direction.copy.onImage.filter((t) => t.lock)];

  // Build the overlay JSX for Satori (using React-like object syntax)
  const element = {
    type: 'div',
    props: {
      style: {
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        backgroundImage: `url(data:${backgroundMimeType};base64,${backgroundBase64})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
      children: [
        // Locked text overlays
        ...lockedTexts.map((lt, i) => ({
          type: 'div',
          key: `locked-${i}`,
          props: {
            style: {
              position: 'absolute' as const,
              ...(lt.position === 'bottom' ? { bottom: '100px', left: '40px', right: '40px' } :
                lt.position === 'top' ? { top: '60px', left: '40px', right: '40px' } :
                lt.position === 'center' ? { top: '50%', left: '40px', right: '40px', transform: 'translateY(-50%)' } :
                { bottom: '100px', left: '40px', right: '40px' }),
              color: textColor,
              fontSize: lt.style === 'legal' || lt.style === 'small' ? '16px' : '36px',
              fontWeight: lt.style === 'legal' || lt.style === 'small' ? '400' : '700',
              textAlign: 'left' as const,
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              lineHeight: '1.3',
            },
            children: lt.text,
          },
        })),
        // Logo
        ...(logoUrl ? [{
          type: 'img',
          key: 'logo',
          props: {
            src: logoUrl,
            style: { ...logoStyle, objectFit: 'contain' as const },
          },
        }] : []),
      ],
    },
  };

  // Render to SVG via Satori
  const svg = await satori(element as unknown as React.ReactNode, {
    width,
    height,
    fonts: [
      { name: 'Inter', data: fontBuffer, weight: 400, style: 'normal' as const },
      { name: 'Inter', data: fontBoldBuffer, weight: 700, style: 'normal' as const },
    ],
  });

  // Render SVG to PNG via resvg
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: width },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return { pngBuffer: Buffer.from(pngBuffer), width, height };
}
