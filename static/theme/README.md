# Theme static assets

Use this folder for **owned** illustrations, logos, and stable onboarding art referenced from [`src/lib/theme/visualAssets.ts`](../../src/lib/theme/visualAssets.ts).

## Guidelines

- Prefer **WebP** or **AVIF** for photos; **SVG** for simple marks.
- Keep hero images roughly **1600–2400px** on the long edge unless the layout is icon-sized.
- Document **license** in the commit or a `LICENSE.theme.md` if assets are not original.

Unsplash URLs in code should be migrated here when you want CDN independence or offline builds.
