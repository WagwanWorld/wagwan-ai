# Brand OS Primitives

This folder contains the canonical shared UI primitives for Wagwan.

Current primitives:

- `OsPageShell.svelte`
- `OsSection.svelte`
- `OsBentoGrid.svelte`
- `OsCard.svelte`
- `OsPill.svelte`
- `OsButton.svelte`
- `OsEmptyState.svelte`
- `OsSkeleton.svelte`

Rules:

- Prefer these components over creating one-off visual wrappers.
- If a new primitive is required, document it in `docs/design/BRAND_OS_DESIGN_SYSTEM.md` first.
- Keep visual styles driven by semantic tokens (`--surface-*`, `--text-*`, `--accent-*`).
