import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
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

// Font cache to avoid re-fetching on every composite
let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff').then(r => r.arrayBuffer()),
    fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff').then(r => r.arrayBuffer()),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

/**
 * Composite ALL text + logo onto the AI-generated background.
 *
 * This is the layer that ensures brand correctness:
 * - ALL on-image text is rendered here with real fonts (not AI-generated)
 * - Logo is always composited (never AI-generated)
 * - Brand colors are used for text and overlays
 * - Semi-transparent background panels behind text for legibility
 */
export async function compositeImage(options: CompositeOptions): Promise<CompositeResult> {
  const { backgroundBase64, backgroundMimeType, direction, logoUrl, brandColors } = options;
  const width = options.width || 1080;
  const height = options.height || 1350; // 4:5

  const fonts = await loadFonts();

  // Extract brand colors
  const bgColor = brandColors.find((c) => c.role === 'background')?.hex || '#000000';
  const textColor = brandColors.find((c) => c.role === 'text')?.hex || '#FFFFFF';
  const accentColor = brandColors.find((c) => c.role === 'accent' || c.role === 'primary')?.hex || brandColors[0]?.hex || '#FFFFFF';

  // ALL onImage text gets composited — not just locked ones
  const allTextBlocks = [
    ...(direction.copy.onImage || []),
    ...(direction.assets.locked || []),
  ];

  // Deduplicate by text content
  const seen = new Set<string>();
  const textBlocks = allTextBlocks.filter((t) => {
    if (seen.has(t.text)) return false;
    seen.add(t.text);
    return true;
  });

  // Build positioned text elements with legibility panels
  const textElements = textBlocks.map((block, i) => {
    const isSmall = block.style === 'legal' || block.style === 'small';
    const isHeadline = i === 0 && !isSmall;
    const fontSize = isSmall ? '18px' : isHeadline ? '42px' : '28px';
    const fontWeight = isSmall ? '400' : '700';

    // Position mapping
    const positionStyle: Record<string, string | number> = { position: 'absolute', left: '48px', right: '48px' };
    const pos = block.position || 'center';
    if (pos.includes('top')) { positionStyle.top = '80px'; }
    else if (pos.includes('bottom')) { positionStyle.bottom = '120px'; }
    else { positionStyle.top = '45%'; }

    return {
      type: 'div',
      key: `text-${i}`,
      props: {
        style: {
          ...positionStyle,
          display: 'flex',
          flexDirection: 'column' as const,
        },
        children: [{
          type: 'div',
          props: {
            style: {
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              borderRadius: '12px',
              padding: isSmall ? '8px 16px' : '16px 24px',
              display: 'inline-flex',
              alignSelf: pos.includes('left') ? 'flex-start' : pos.includes('right') ? 'flex-end' : 'flex-start',
            },
            children: [{
              type: 'span',
              props: {
                style: {
                  color: isHeadline ? accentColor : textColor,
                  fontSize,
                  fontWeight,
                  lineHeight: '1.35',
                  letterSpacing: isHeadline ? '-0.02em' : '0',
                },
                children: block.text,
              },
            }],
          },
        }],
      },
    };
  });

  // CTA element if present
  const ctaElement = direction.copy.cta ? {
    type: 'div',
    key: 'cta',
    props: {
      style: {
        position: 'absolute' as const,
        bottom: '48px',
        left: '48px',
        right: '48px',
        display: 'flex',
        justifyContent: 'center' as const,
      },
      children: [{
        type: 'div',
        props: {
          style: {
            backgroundColor: accentColor,
            color: '#FFFFFF',
            padding: '12px 32px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '0.02em',
          },
          children: direction.copy.cta,
        },
      }],
    },
  } : null;

  // Logo element
  const logoElement = logoUrl ? {
    type: 'img',
    key: 'logo',
    props: {
      src: logoUrl,
      style: {
        position: 'absolute' as const,
        width: '64px',
        height: '64px',
        objectFit: 'contain' as const,
        ...(direction.assets.logo.position?.includes('bottom') ? { bottom: '48px' } : { top: '48px' }),
        ...(direction.assets.logo.position?.includes('left') ? { left: '48px' } : { right: '48px' }),
      },
    },
  } : null;

  // Assemble the full element tree
  const children = [
    ...textElements,
    ...(ctaElement ? [ctaElement] : []),
    ...(logoElement ? [logoElement] : []),
  ];

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
      children,
    },
  };

  // Render to SVG via Satori
  const svg = await satori(element as unknown as React.ReactNode, {
    width,
    height,
    fonts: [
      { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' as const },
      { name: 'Inter', data: fonts.bold, weight: 700, style: 'normal' as const },
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
