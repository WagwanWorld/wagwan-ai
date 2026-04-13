# Wagwan Onboarding Auth + Landing Page

**Date:** 2026-04-14
**Goal:** Replace the current splash redirect at `/` with a one-page landing page explaining Wagwan AI, and add phone+OTP verification as the first step of onboarding — syncing the user to the Wagwan platform before any OAuth connections.

---

## 1. Landing Page (`/`)

Replace the current splash/redirect in `src/routes/+page.svelte` with a proper single-page landing.

**Content:**
- Hero section with Wagwan AI branding (acid-lime on dark, Bodoni Moda display font)
- Short value proposition: what Wagwan AI does (identity-first AI that learns who you are from your connected platforms and gives you personalized recommendations, insights, and a living digital identity)
- 2-3 feature highlights (cards or icons): e.g. "Know yourself better", "Personalized everything", "Your data, your control"
- CTA button: "Get Started" → navigates to `/onboarding`
- If user already has a valid session (`setupComplete`), auto-redirect to `/home` (preserve existing behavior but redirect to `/home` instead of `/profile`)

**Design:**
- Full viewport, no scroll needed (single screen)
- Uses existing dark theme tokens (`--bg-primary`, `--text-primary`, `--home-lime`)
- Ambient gradient orbs (reuse existing `startGradient` pattern)
- Bodoni Moda for headline, Geist for body
- Mobile-first, works on all screen sizes

---

## 2. Wagwan Auth Step (Onboarding Step 0)

Add phone + OTP verification as the **first step** of onboarding, before Google OAuth.

### Flow

```
Landing → Onboarding Step 0a: Enter phone number
       → Onboarding Step 0b: Enter OTP (6 digits)
       → JWT received → store tokens → proceed to Step 1 (Google OAuth)
```

### Step 0a: Phone Input
- Header: "Let's get you started"
- Input: phone number with `+91` country code prefix (Indian numbers, 13 chars total)
- Button: "Send OTP"
- Calls `POST /api/wagwan/auth/send-otp` → proxies to gRPC `GenerateOTP`
- On success: transition to Step 0b
- On error: show inline error

### Step 0b: OTP Verification
- Header: "Enter the code we sent"
- Subtext: shows the phone number, with "Change" link to go back
- Input: 6-digit OTP (auto-advance on 6th digit)
- Button: "Verify"
- Calls `POST /api/wagwan/auth/verify-otp` → proxies to gRPC `VerifyLoginOTP`
- On success:
  - Store `wagwan_access_token` and `wagwan_refresh_token` in localStorage
  - Decode JWT to extract wagwan user UUID (the `id` claim)
  - Store `wagwan_user_id` in localStorage
  - Proceed to Step 1 (Google OAuth)
- On error: show inline error, allow retry

### Session Storage

New localStorage keys:
- `wagwan_access_token` — JWT from VerifyLoginOTP
- `wagwan_refresh_token` — refresh token from VerifyLoginOTP  
- `wagwan_user_id` — decoded from JWT `id` claim

At the end of onboarding (when profile is saved to Supabase), call the existing `linkWagwanUser` helper to associate the wagwan user ID with the profile row.

---

## 3. Server-Side gRPC Proxy

### gRPC Client Module

**File:** `src/lib/server/wagwanGrpc.ts`

Connects to the Wagwan Go backend's `AuthService` via gRPC.

- Uses `@grpc/grpc-js` and `@grpc/proto-loader` to load the proto definition
- Proto file: copy `wagwan/auth/api/v1/auth.proto` and its dependency `wagwan/utils/date.proto` into `src/lib/server/proto/` (avoids cross-repo dependency)
- Reads `WAGWAN_GRPC_URL` from env (default `127.0.0.1:50051`)
- Exports two async functions:
  - `generateOTP(phone: string): Promise<void>`
  - `verifyLoginOTP(phone: string, otp: string): Promise<{ accessToken: string; refreshToken: string }>`

### API Routes

**`POST /api/wagwan/auth/send-otp`**
- Body: `{ "phone": "+91XXXXXXXXXX" }`
- Validates phone is 13 chars, starts with `+`
- Calls `generateOTP(phone)`
- Returns `{ ok: true }` or `{ ok: false, error: "..." }`

**`POST /api/wagwan/auth/verify-otp`**
- Body: `{ "phone": "+91XXXXXXXXXX", "otp": "123456" }`
- Validates phone (13 chars) and otp (6 chars)
- Calls `verifyLoginOTP(phone, otp)`
- Returns `{ ok: true, accessToken, refreshToken }` or `{ ok: false, error: "..." }`

---

## 4. Onboarding Step Numbering

Current steps in `src/routes/onboarding/+page.svelte`:
- Step 1: Google OAuth
- Step 2: Instagram OAuth
- Step 3: Optional platforms (Spotify, LinkedIn, Apple Music)
- Step 4: Preferences
- Step 5: Complete

New steps:
- **Step 0: Wagwan Auth (phone + OTP)** ← NEW
- Step 1: Google OAuth (unchanged)
- Step 2: Instagram OAuth (unchanged)
- Step 3: Optional platforms (unchanged)
- Step 4: Preferences (unchanged)
- Step 5: Complete — also calls `linkWagwanUser` to tie the wagwan user ID to the Supabase profile

The existing `step` variable starts at `1`. We change it to start at `0`. All existing step checks (`step === 1`, etc.) remain the same — the new auth step is `step === 0`.

---

## 5. Profile Linking

At the end of onboarding (the existing `finishSetup` function), after saving the profile to Supabase:

1. Read `wagwan_user_id` from localStorage
2. If present, `POST /api/wagwan/link` with the wagwan JWT and googleSub to link the accounts in Supabase
3. Store wagwan tokens in the profile store for later use

---

## 6. Environment Variables

New env var in `.env`:
```
WAGWAN_GRPC_URL=127.0.0.1:50051
```

Add to `.env.example` with documentation.

---

## 7. Dependencies

New npm packages:
- `@grpc/grpc-js` — gRPC client for Node.js
- `@grpc/proto-loader` — loads .proto files at runtime

---

## 8. File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/server/proto/auth.proto` | Copy of wagwan auth proto |
| Create | `src/lib/server/proto/date.proto` | Copy of wagwan utils date proto |
| Create | `src/lib/server/wagwanGrpc.ts` | gRPC client for AuthService |
| Create | `src/routes/api/wagwan/auth/send-otp/+server.ts` | Proxy for GenerateOTP |
| Create | `src/routes/api/wagwan/auth/verify-otp/+server.ts` | Proxy for VerifyLoginOTP |
| Modify | `src/routes/+page.svelte` | Replace splash with landing page |
| Modify | `src/routes/onboarding/+page.svelte` | Add Step 0 (phone+OTP), link wagwan user at finish |
| Modify | `.env.example` | Add WAGWAN_GRPC_URL |
