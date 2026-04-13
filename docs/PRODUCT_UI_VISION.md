# Wagwan — product and UI vision

## North star

Wagwan is the user’s **personal twin**: one intelligent companion across **home context**, **exploration**, **conversation**, and **identity**. The product should feel like **one continuous experience**, not separate apps stitched together.

## Principles

1. **One canvas** — One atmospheric backdrop (mesh + base wash). Routes differ by content density and hierarchy, not by replacing the entire background.
2. **Depth ladder** — Page base → glass panels → floating chrome (nav, composer) → modals.
3. **Predictable scroll** — Each screen has one obvious vertical scroll (except modals and horizontal carousels).
4. **Tokens first** — Brand and theme are controlled via CSS variables and shared components; avoid one-off hex in pages.
5. **Personalization on rails** — Profile-driven accent colors tune highlights; they do not introduce a second background system.

## Success signals

- Five-route walkthrough (Home, Explore, AI, Profile, Onboarding) on the **light** product surface feels **cohesive** (warm-neutral canvas, soft mesh, crisp panels).
- Operators can find **where to change fonts and colors** via [THEME.md](./THEME.md) in under two minutes.
- Users rarely report “page won’t scroll” on Home after latch interaction is clear.

## Ownership

- **Design / product**: `docs/THEME.md`, imagery briefs, copy for empty states.
- **Engineering**: `src/styles/*`, mesh component, layout scroll behavior, `identityColors.ts` logic.
