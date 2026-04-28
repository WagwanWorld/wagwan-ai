import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

export interface LogoCompositeOptions {
  imageBase64: string;
  imageMimeType: string;
  logoUrl?: string;
  logoPosition?: string; // bottom-right, bottom-left, top-right, top-left
  width?: number;
  height?: number;
}

export interface CompositeResult {
  pngBuffer: Buffer;
  width: number;
  height: number;
}

// Font cache
let fontCache: ArrayBuffer | null = null;

async function loadFont() {
  if (fontCache) return fontCache;
  const res = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff');
  fontCache = await res.arrayBuffer();
  return fontCache;
}

/**
 * LOGO-ONLY compositor.
 *
 * Gemini (Nano Banana) now handles ALL text rendering in the image.
 * This compositor ONLY overlays the brand logo onto the final image.
 * If no logo is provided, it passes the image through unchanged.
 */
export async function compositeLogoOnly(options: LogoCompositeOptions): Promise<CompositeResult> {
  const { imageBase64, imageMimeType, logoUrl, logoPosition } = options;
  const width = options.width || 1080;
  const height = options.height || 1350;

  // If no logo, just convert base64 to buffer and return
  if (!logoUrl) {
    return {
      pngBuffer: Buffer.from(imageBase64, 'base64'),
      width,
      height,
    };
  }

  const font = await loadFont();

  // Position the logo
  const pos = logoPosition || 'bottom-right';
  const logoStyle: Record<string, string | number> = {
    position: 'absolute',
    width: '64px',
    height: '64px',
    objectFit: 'contain',
  };
  if (pos.includes('bottom')) logoStyle.bottom = '40px';
  else logoStyle.top = '40px';
  if (pos.includes('right')) logoStyle.right = '40px';
  else logoStyle.left = '40px';

  const element = {
    type: 'div',
    props: {
      style: {
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative' as const,
        display: 'flex',
        backgroundImage: `url(data:${imageMimeType};base64,${imageBase64})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
      children: [{
        type: 'img',
        key: 'logo',
        props: {
          src: logoUrl,
          style: logoStyle,
        },
      }],
    },
  };

  const svg = await satori(element as unknown as React.ReactNode, {
    width,
    height,
    fonts: [{ name: 'Inter', data: font, weight: 400, style: 'normal' as const }],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width' as const, value: width } });
  const pngData = resvg.render();

  return {
    pngBuffer: Buffer.from(pngData.asPng()),
    width,
    height,
  };
}
