# Vercel Deployment — Phase 1 Go Live

Deploy wagwan-ai to Vercel so creators can sign up, connect socials, and start building the network.

## Problem

App runs locally only (ngrok). No one can use it. Need to get it live on a public URL with all OAuth flows working.

## Design

### 1. Swap Adapter

Replace `@sveltejs/adapter-node` with `@sveltejs/adapter-vercel`.

**Files:**
- `package.json` — swap dependency
- `svelte.config.js` — import new adapter, add config for streaming routes

Configure the match-agent SSE endpoint with `maxDuration: 60` via SvelteKit route config to stay within Vercel free tier limits.

### 2. Add vercel.json

Minimal config at project root:
- Node.js 20 runtime
- SvelteKit framework preset
- No custom rewrites needed (SvelteKit handles routing)

### 3. Route Config for Streaming

The brand match-agent endpoint (`/api/brand/match-agent`) uses SSE streaming with a 90s Anthropic timeout. On Vercel free tier, serverless functions have a 60s max. Add SvelteKit route-level config to set `maxDuration` and mark as streaming.

### 4. Environment Variables

All existing `.env` vars must be added to Vercel. The key ones:
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
- `COOKIE_SECRET`
- `PUBLIC_BASE_URL` — set to Vercel deployment URL (e.g. `https://wagwan-ai.vercel.app`)
- `BRAND_PORTAL_SECRET` — set a new secret value
- `BRAVE_API_KEY`

Public vars (prefixed `PUBLIC_`) must be added with that prefix in Vercel too.

### 5. OAuth Redirect URI Updates

After deployment, user must update redirect URIs in each developer console:

**Google Cloud Console** (console.cloud.google.com):
- `https://<vercel-url>/auth/google/callback`

**Meta Developer Portal** (developers.facebook.com):
- `https://<vercel-url>/auth/instagram/callback`

**Spotify Developer Dashboard** (developer.spotify.com):
- `https://<vercel-url>/auth/spotify/callback`

**LinkedIn Developer Portal** (linkedin.com/developers):
- `https://<vercel-url>/auth/linkedin/callback`

### 6. Build & Deploy

- Commit adapter swap + vercel.json
- Push to GitHub
- Connect repo in Vercel dashboard (vercel.com/new)
- Add all env vars in Vercel project settings
- First deploy triggers automatically
- Verify: homepage loads, onboarding flow works, OAuth redirects work

## Out of Scope

- No new features or UI changes
- No database changes (Supabase already cloud-hosted)
- No Orio search integration (local dev only)
- No custom domain (use default vercel.app subdomain)
- No CI/CD beyond Vercel's built-in git deploys
