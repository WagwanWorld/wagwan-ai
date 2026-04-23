# Production Keep List (2026-04-23)

Source of truth used (reconfirmed):

- Vercel project: `wagwan-ai` (`prj_Ca9xYxxN9t3JrJEQvfZ0Jgnz8KJX`)
- Environment: `production`
- Evidence: latest production deployments + production runtime logs (last 7 days)
- Reconfirmed deployment: `dpl_4ANYvr5jj6db2yZcMigPSfe4AbyB`

## Keep (Observed in Production Runtime)

- Landing route: `/`
- Creator route: `/home`
- API: `/api/chat`, `/api/chat/thread`
- API: `/api/home/morning-brief`, `/api/home/rich-recs`
- API: `/api/profile/load`
- API: `/api/user/campaigns`, `/api/user/wallet`, `/api/user/persona`, `/api/user/graph-strength`, `/api/user/marketing-prefs`, `/api/user/identity-tags`
- API: `/api/creator/rates`, `/api/creator/visibility`, `/api/creator/ecosystem-brands`

## Keep (Critical Product Surface by Dependency Trace)

- Landing/onboarding: `src/routes/+page.svelte`, `src/routes/onboarding/+page.svelte`
- Creator shell/pages: `src/routes/(app)/+layout.svelte`, `src/routes/(app)/home/+page.svelte`, `src/routes/(app)/profile/+page.svelte`, `src/routes/(app)/earn/+page.svelte`
- Brand shell/pages: `src/routes/brands/+layout.svelte`, `src/routes/brands/+page.svelte`, `src/routes/brands/login/+page.svelte`, `src/routes/brands/portal/+page.svelte`, `src/routes/brands/creators/+page.svelte`
- Shared nav: `src/lib/components/DesktopSidebar.svelte`, `src/lib/components/FloatingNav.svelte`

## Removed In This Pass

- High-confidence dead components removed from `src/lib/components` and `src/lib/components/home`.
- Medium-confidence routes removed: `src/routes/preview/+page.svelte`, `src/routes/brand/+page.svelte`.
- Legacy API endpoints tied to removed `/brand` route removed:
  - `src/routes/api/brand/match/+server.ts`
  - `src/routes/api/brand/expand/+server.ts`
  - `src/routes/api/brand/correlations/+server.ts`
  - `src/routes/api/brands/login/+server.ts`
