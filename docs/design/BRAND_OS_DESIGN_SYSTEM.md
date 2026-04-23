# Brand OS Design System (Canonical Source)

This document is the single source of truth for all frontend visual decisions across Wagwan.

If a new page, component, or style rule does not follow this document, it should be treated as a regression.

## 1) Principles

- One product, one visual language: landing, creator, and brand surfaces share the same system.
- Component-first UI: compose from reusable primitives; avoid page-local one-off visual patterns.
- Bento clarity: use clean grid rhythm, strong hierarchy, and intentional negative space.
- Functional premium: visual polish must improve comprehension and actionability.
- State-complete components: each interactive component must handle loading, empty, error, disabled, and focus states.

## 2) Theme & Token Contract

All UI should use semantic tokens, never hardcoded palette values.

### Core semantic token families

- `--surface-*`: backgrounds and panel layers
- `--text-*`: typographic contrast levels
- `--border-*`: divider and control outlines
- `--accent-*`: brand emphasis and action colors
- `--elevation-*`: shadows and depth hierarchy
- `--glass-*`: translucent fills and strokes
- `--motion-*`: duration and easing curves
- `--radius-*`: corner system
- `--space-*`: spacing scale

### Rules

- Do not introduce new token namespaces without updating this document.
- Do not use route-level hex overrides for brand identity.
- Prefer aliases over parallel token systems.
- Keep light/dark behavior under one semantic contract.

## 3) Layout Grammar

### Bento grid

- Base grid gap: `var(--space-4)` desktop, `var(--space-3)` mobile.
- Card radius and stroke must match primitive defaults.
- Use mixed card spans for hierarchy (`hero`, `analysis`, `supporting`).
- Avoid visual noise: no nested decorative wrappers unless meaningful.

### Spacing

Canonical scale:

- `--space-1: 4px`
- `--space-2: 8px`
- `--space-3: 12px`
- `--space-4: 16px`
- `--space-5: 24px`
- `--space-6: 32px`
- `--space-7: 48px`
- `--space-8: 64px`

### Breakpoints

- Mobile: <= 767px
- Tablet: 768-1023px
- Desktop: >= 1024px

Component behavior should rely on container logic when possible; pages own macro layout.

## 4) Canonical Primitive Set

All pages should compose from these primitives:

- `OsPageShell`
- `OsSection`
- `OsBentoGrid`
- `OsCard`
- `OsPill`
- `OsBadge`
- `OsStat`
- `OsButton`
- `OsInput`
- `OsTabs`
- `OsEmptyState`
- `OsSkeleton`
- `OsDialog`
- `OsSheet`
- `OsFormField`
- `OsTable`
- `OsToast`
- `OsInlineAlert`

### Primitive requirements

- Public props are documented and stable.
- Support dark and light scheme through semantic tokens.
- Built-in focus-visible and keyboard accessibility.
- Expose slots for flexible composition.
- No hardcoded brand palette values.

## 5) Interaction, Motion, and Accessibility

- Motion must communicate state, not decoration.
- Respect reduced-motion and disable non-essential animation.
- Maintain AA contrast for text and controls.
- Ensure keyboard navigation and visible focus in all interactive primitives.
- Avoid modal overuse; prefer inline progressive disclosure when possible.

## 6) Prohibited Patterns

- Multiple competing design systems in parallel.
- New hardcoded color literals in page/component style blocks.
- Route-local visual token contracts.
- Custom button/card variants outside primitives.
- Side accent stripe patterns as primary visual treatment.
- Gradient text.

## 7) Migration & Enforcement

### Migration labels

- `compliant`: already follows Brand OS.
- `migrate`: needs primitive/token migration.
- `remove`: legacy style pattern must be deleted or replaced.

### PR checklist (required)

- Which `Os*` primitives are used?
- Which legacy styles were removed?
- Which states were validated (loading/empty/error/disabled/focus)?
- Does the change conform to this document without introducing a new visual dialect?

## 8) Source Files Governed By This Contract

- `src/styles/*`
- `src/lib/components/*`
- `src/routes/**/*.svelte`

All future frontend edits should reference this document first.
