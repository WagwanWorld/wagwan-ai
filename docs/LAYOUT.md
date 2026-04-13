# Wagwan layout and scroll contract

The app uses a **fixed viewport shell** (`html`, `body` and root layout use `overflow: hidden`). Scrolling happens **inside** designated regions.

## Flex rule

Any flex parent between the scroll container and the viewport needs **`min-height: 0`** (or `min-h-0` in Tailwind) so children can shrink and scroll.

## Scroll owner by route

| Route | Primary vertical scroll | Notes |
|-------|-------------------------|--------|
| **Home (collapsed)** | None on `app-content`; latch area is flex | Swipe / tap to expand feed |
| **Home (feed expanded)** | `#home-feed-scroll-region` | `flex: 1; min-height: 0; overflow-y: auto` |
| **Explore** | `.ex` or route root with `overflow-y: auto` | Inside `app-content` (scroll enabled) |
| **AI** | `.messages-area` (or equivalent) | Chat scroll separate from composer |
| **Profile** | Page root / `.pf-*` wrapper | `app-content` scrolls |
| **Onboarding** | `.ob-content` | Full-screen route, internal scroll |

## App shell ([`src/routes/(app)/+layout.svelte`](../src/routes/(app)/+layout.svelte))

- **`app-content`**: `overflow-y-auto` for all routes **except** `/home` (keeps latch UX). When Home feed is expanded, inner `#home-feed-scroll-region` scrolls.
- **`--nav-dock-gap` / `--floating-nav-dock-gap`**: Safe area + mobile dock padding for fixed composers.

## Desktop scrollbars

On viewports `min-width: 1024px`, **`.app-scroll-region`** shows a thin scrollbar on the primary column. Horizontal carousels keep hidden scrollbars.

## Home latch (Path A)

Users interact with a **two-layer** Home: hero/latch, then expanded feed.

- **`wagwan_home_feed_hint_seen`** (`localStorage`): after the first successful feed expand, the extra latch pill hint is hidden; swipe/tap copy remains in the footer when the pill is off.
- **`home-sheet-revealed`** (`sessionStorage`): one-time sheet reveal animation on first swipe-up expand (see Home route).

See [PRODUCT_UI_VISION.md](./PRODUCT_UI_VISION.md) for product intent.
