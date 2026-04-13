# Wagwan theme operator handbook

Use this file to find **where to change** fonts, colors, mesh mood, and marketing imagery.

## Quick map

| What you want to change | Where to edit |
|-------------------------|---------------|
| Colors, panels, text (product surface) | [`src/styles/tokens-light.css`](../src/styles/tokens-light.css) |
| Shared radii, blur, mesh strength, brand constants | [`src/styles/tokens-shared.css`](../src/styles/tokens-shared.css) |
| Font family / imports | [`src/styles/typography.css`](../src/styles/typography.css) + Tailwind [`tailwind.config.js`](../tailwind.config.js) `fontFamily.sans` |
| Buttons, panels, UI utilities | [`src/styles/components.css`](../src/styles/components.css) |
| Page background wash (under mesh) | `.ambient-bg` in [`src/styles/utilities-extra.css`](../src/styles/utilities-extra.css) |
| Animations, category card gradients | [`src/styles/utilities-extra.css`](../src/styles/utilities-extra.css) |
| Accent from user profile (Instagram, etc.) | [`src/lib/theme/identityColors.ts`](../src/lib/theme/identityColors.ts) |
| Feed / card fallback photos (Unsplash) | [`src/lib/suggestionImagery.ts`](../src/lib/suggestionImagery.ts) |
| Onboarding / empty-state / hero imagery | [`src/lib/theme/visualAssets.ts`](../src/lib/theme/visualAssets.ts) + [`static/theme/README.md`](../static/theme/README.md) |
| Document theme + PWA chrome color | [`src/lib/stores/theme.ts`](../src/lib/stores/theme.ts), [`src/app.html`](../src/app.html) |

## Token naming (semantic)

- **Background**: `--bg-primary`, `--bg-secondary`, `--bg-elevated`
- **Text**: `--text-primary`, `--text-secondary`, `--text-muted`
- **Accent** (may be overridden at runtime by identity): `--accent-primary`, `--accent-secondary`, `--accent-glow`, `--accent-soft`
- **Panels**: `--panel-surface`, `--panel-border`, `--panel-divider`
- **Mesh**: `--ambient-blue`, `--ambient-red`, `--ambient-gold`; `--mesh-orb-base-opacity` in `tokens-light.css`; combined orb opacity ≈ base × `--mesh-orb-opacity-scale` from `html[data-app-surface]` in `tokens-shared.css`; `--mesh-blur-scale` in `tokens-shared.css`
- **Soft accent (chips / borders)**: `--accent-gradient-wash`, `--accent-border-mesh` in `tokens-light.css`

## Rules

- Do not add **full-screen fixed backgrounds** on individual routes for “mood.” Use the global mesh + `.ambient-bg`.
- New primary actions should use `.btn-primary` / `.btn-secondary` / `.btn-danger` from `components.css`, not inline colors.

See also [PRODUCT_UI_VISION.md](./PRODUCT_UI_VISION.md) and [LAYOUT.md](./LAYOUT.md).
