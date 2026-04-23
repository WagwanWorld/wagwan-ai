# API Surface Ownership Map

This directory is organized by domain paths under `src/routes/api`.

## Primary Domains

- `api/user/*` — creator profile and wallet-facing user data
- `api/creator/*` — creator market operations (rates, visibility, brief responses)
- `api/home/*` — creator home feed, brief, and recommendation endpoints
- `api/chat/*` — chat and thread memory operations
- `api/brand/*` — brand portal operations and campaign workflows
- `api/profile/*` — profile save/load lifecycle
- `api/wagwan/*` — Wagwan platform linking and auth bridge
- `api/google/*`, `api/instagram/*` — provider data integrations

## Ownership Rules

1. Place new endpoints in the closest domain folder instead of adding flat one-off endpoints.
2. Keep server auth checks domain-consistent (`brandAuth`, creator session checks, etc.).
3. If an endpoint only supports one UI surface, document that in route-level comments.
