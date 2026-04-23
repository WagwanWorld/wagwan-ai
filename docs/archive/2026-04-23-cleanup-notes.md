# 2026-04-23 Cleanup Archive Notes

This file tracks medium-confidence cleanup actions taken during the Vercel production-alignment pass.

## Archived via Git History (Route-Level)

- `src/routes/preview/+page.svelte`
  - Removed from active routes.
  - No production runtime evidence and no in-repo route links.
- `src/routes/brand/+page.svelte`
  - Removed from active routes.
  - Legacy standalone brand-audience UI, separate from current `/brands` portal flow.

## Follow-up

- If either route is needed again, restore from Git history and re-validate against current `/brands` and creator architecture before reintroducing.
