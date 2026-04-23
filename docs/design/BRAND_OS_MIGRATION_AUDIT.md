# Brand OS Migration Audit

This audit maps current frontend surfaces to the canonical design contract in `docs/design/BRAND_OS_DESIGN_SYSTEM.md`.

## Classification

- `compliant`: already close to Brand OS token/component model.
- `migrate`: should be refactored to `Os*` primitives and semantic tokens.
- `remove-legacy`: style dialect should be removed or merged into Brand OS.

## Route Inventory

| Surface    | Route                      | Status  | Notes                                                                       |
| ---------- | -------------------------- | ------- | --------------------------------------------------------------------------- |
| Landing    | `/`                        | migrate | Uses bespoke marketing styles; migrate to `OsPageShell` + bento primitives. |
| Onboarding | `/onboarding`              | migrate | Functional flow is solid; visual contract needs token/primitives migration. |
| Auth       | `/auth/applemusic/connect` | migrate | Keep state machine, migrate visual treatment.                               |
| Creator    | `/home`                    | migrate | Largest custom visual surface; route-local palette should be removed.       |
| Creator    | `/explore`                 | migrate | Convert to shared cards/empty states/tabs.                                  |
| Creator    | `/ai`                      | migrate | Align chat/assistant cards with Brand OS primitives.                        |
| Creator    | `/profile`                 | migrate | Convert panels/stat blocks to shared primitives.                            |
| Creator    | `/earn`                    | migrate | Align cards, controls, pills, and wallet modules.                           |
| Creator    | `/chats`                   | migrate | Rebuild thread list and empty states with `Os*` primitives.                 |
| Creator    | `/chat/[id]`               | migrate | Preserve thread UX; migrate frame/states to canonical shell.                |
| Brand      | `/brands`                  | migrate | Already bento-driven, but uses route-local style dialect.                   |
| Brand      | `/brands/login`            | migrate | Needs canonical card/form/button states.                                    |
| Brand      | `/brands/portal`           | migrate | High complexity; migrate component-by-component to `Os*`.                   |
| Brand      | `/brands/creators`         | migrate | Convert search/results/grid to shared primitives.                           |
| Legal      | `/privacy`                 | migrate | Lightweight migration to canonical page shell.                              |
| Legal      | `/terms`                   | migrate | Lightweight migration to canonical page shell.                              |
| Legal      | `/data-deletion`           | migrate | Lightweight migration to canonical page shell.                              |

## Component Group Inventory

| Group                | Path                                                                                                      | Status  | Notes                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| Shared shell         | `src/lib/components/DesktopSidebar.svelte`, `FloatingNav.svelte`                                          | migrate | Align to one chrome language and shared nav primitives.           |
| Brand modules        | `src/lib/components/brands/*`                                                                             | migrate | Convert ad-hoc cards and controls to shared `Os*`.                |
| Home modules         | `src/lib/components/home/*`                                                                               | migrate | Normalize visual style and remove route-local palette dependence. |
| Earn modules         | `src/lib/components/earn/*`                                                                               | migrate | Adopt canonical card/action/input primitives.                     |
| Chat modules         | `src/lib/components/chats/*`, `src/lib/chat/*`                                                            | migrate | Align thread shell, chips, bubble typography and controls.        |
| Cross-surface panels | `IdentityIntelligencePanel`, `InferenceIdentityPanel`, `InferenceFocusGrid`, `ResultCard`, `TwinPresence` | migrate | Keep behavior, migrate visual contract to semantic token model.   |

## Style System Inventory

| File                                   | Status        | Action                                                              |
| -------------------------------------- | ------------- | ------------------------------------------------------------------- |
| `src/styles/tokens-shared.css`         | compliant     | Keep as base and expand semantic coverage.                          |
| `src/styles/tokens-light.css`          | migrate       | Align naming to unified semantic system.                            |
| `src/styles/tokens-home-dark.css`      | migrate       | Merge into unified light/dark contract.                             |
| `src/styles/tokens-glass.css`          | migrate       | Alias `--g-*` to semantic tokens and reduce drift.                  |
| `src/styles/tokens-editorial.css`      | remove-legacy | Deprecate or merge into canonical token contract.                   |
| `src/styles/tokens-editorial-dark.css` | remove-legacy | Deprecate or merge into canonical token contract.                   |
| `src/styles/components.css`            | migrate       | Add canonical `Os*` primitive styles and remove duplicate patterns. |

## Priority Order

1. Token unification and legacy style removal.
2. Shared primitive layer (`Os*`).
3. Shell unification.
4. Brand surface migration.
5. Creator surface migration.
6. Landing/onboarding/legal migration.

## Baseline Snapshot Targets

- `src/routes/brands/+page.svelte`
- `src/routes/brands/portal/+page.svelte`
- `src/routes/(app)/home/+page.svelte`
- `src/routes/(app)/earn/+page.svelte`
- `src/routes/(app)/ai/+page.svelte`
- `src/routes/+page.svelte`
