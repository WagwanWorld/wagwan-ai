# Components Ownership Map

This folder is organized by product surface ownership.

## Surface Folders

- `brands/` — brand portal and audience intelligence UI
- `home/` — creator home dashboard UI
- `earn/` — creator earn/rates/visibility UI
- `chats/` — creator chat thread UI

## Shared Components

Top-level files in this directory are shared across multiple surfaces (for example navigation chrome and reusable identity panels).

Current shared examples:

- `DesktopSidebar.svelte`
- `FloatingNav.svelte`
- `PersonaBg.svelte`
- `ShareCardModal.svelte`
- `ResultCard.svelte`
- `IdentityIntelligencePanel.svelte`
- `InferenceIdentityPanel.svelte`
- `InferenceFocusGrid.svelte`

## Structure Rules

1. New feature-specific components should be added inside a surface folder (`brands`, `home`, `earn`, `chats`) rather than at the top level.
2. Top-level components should only be used by multiple surfaces.
3. When a top-level component becomes surface-specific, move it into that surface folder and update imports atomically.
