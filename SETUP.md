# Wagwan AI — Setup Guide

## Quick Start

```bash
cd /Users/madhviknemani/wagwan-ai
cp .env.example .env   # already done
npm run dev
```

Open http://localhost:5173

---

## API Keys (fill in .env)

### 1. Anthropic (Claude AI) — REQUIRED for chat
1. Go to https://console.anthropic.com/
2. Create API key
3. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`

### 2. Brave Search API — REQUIRED for real web results
Chat, explore, and recommendations use the [Brave Web Search API](https://api.search.brave.com/documentation).

1. Open https://api-dashboard.search.brave.com/
2. Create a subscription / API key (token starts with `BSA`)
3. Add to `.env`: `BRAVE_API_KEY=BSA...` (sent as header `X-Subscription-Token`)

Optional self-hosted alternative: you can still run [OrioSearch](https://www.oriosearch.org/) separately (`npm run orio`); the app code path is Brave-only unless you change `search.ts`.

### 3. Instagram — REQUIRED for identity signals
This is the most important one for the product's core value.

> **Note:** Instagram Basic Display API was shut down in December 2024.
> This app uses the new **Instagram API with Instagram Login**.

**Step-by-step:**
1. Go to https://developers.facebook.com/apps/
2. Click "Create App" → choose "Consumer" type
3. Add the **Instagram** product → select **Instagram API with Instagram Login**
4. Under Instagram → API setup with Instagram Login:
   - Add OAuth Redirect URIs: `http://localhost:5173/auth/instagram/callback`
5. Copy **App ID** → `INSTAGRAM_APP_ID=`
6. Copy **App Secret** → `INSTAGRAM_APP_SECRET=`
7. **Add Test Users**: Under Instagram → Test Users → Add your Instagram account
   - The user must accept the test invitation (Instagram app → Settings → Apps and Websites)

> During development, only added test users can authenticate. For public launch,
> submit for Instagram's review to enable all users.

---

## Architecture

```
/src
  /routes
    /onboarding        ← 6-step setup flow
    /auth/instagram    ← OAuth initiation + callback
    /(app)
      /home            ← Personalised picks, refreshed on load
      /ai              ← Chat with real-time search
      /explore         ← Search anything
      /profile         ← Identity, saved items, controls
    /api
      /chat            ← POST: message + profile → Claude + web search → cards
      /recommendations ← POST: profile → home picks
  /lib
    /server
      instagram.ts     ← OAuth, media fetch, Claude identity analysis
      search.ts        ← OrioSearch / Tavily-compatible search wrapper
      ai.ts            ← Claude prompts, card types, response parsing
    /stores
      profile.ts       ← localStorage-persisted user profile
    /components
      ResultCard.svelte ← Reusable card (full + compact variants)
      BottomNav.svelte  ← Tab navigation
```

## How the Instagram identity flow works

1. User clicks "Connect Instagram" in onboarding step 4
2. → `/auth/instagram` redirects to Instagram OAuth
3. User authorises on Instagram → redirected back to `/auth/instagram/callback`
4. Server exchanges code for access token (server-side only, never sent to client)
5. Fetches last 20 posts (captions, hashtags)
6. Sends to Claude: "analyse this person's identity"
7. Claude returns structured JSON: aesthetic, music vibe, food vibe, brand affinities, lifestyle summary
8. Identity stored in client localStorage (token discarded)
9. All subsequent AI queries are personalised using this identity

## How the AI chat works

1. User sends a message (or clicks a prompt chip)
2. Frontend POSTs to `/api/chat` with message + full profile
3. Server builds 3 parallel web-search queries (based on message + profile)
4. Deduplicates and formats results
5. Claude processes: "given this user's identity and these real web results, return 4 cards"
6. Cards rendered with title, description, real URL, match score, personalised reason

The AI is lifestyle-first — it surfaces music, food, nightlife, experiences, fashion.
Deals are one category among many, not the default lens.
