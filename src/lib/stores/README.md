# Stores Ownership Map

Stores are grouped by responsibility, even when they remain in one folder for stable import paths.

## Shared App Stores

- `profile.ts` — canonical creator profile state shared across landing/onboarding/app
- `theme.ts` — theme document sync and preferences

## Creator Runtime Stores

- `chatMemory.ts`
- `contextStore.ts`
- `feedCache.ts`
- `homePersonaSessionCache.ts`
- `reminders.ts`
- `twinMemory.ts`

## Structure Rules

1. Shared cross-surface stores should remain generic and small.
2. Creator-only stores should avoid brand-specific concerns.
3. If a store is only used by one route, prefer route-local state over adding a global store.
