# Dashboard Living Redesign

## Summary

Restyle the Brand OS dashboard and follower analytics into a single "Living Dashboard" on the Content Studio home page. Kill the serif font, add color-coded gradient cards, inline demographics, and remove the separate Follower Analytics tab.

## Typography

- **Hero numbers**: `'Inter', 'Geist Variable', sans-serif` weight 800, sizes 28-36px, letter-spacing -0.03em
- **Secondary numbers**: Same font, weight 700, sizes 18-20px
- **Labels**: `'Geist Mono Variable', monospace` weight 600, sizes 8-10px, uppercase, letter-spacing 0.08-0.1em
- **Body text**: `'PP Mori', 'Inter', sans-serif` weight 400-500, sizes 11-14px
- **Kill**: `'Bodoni Moda'` serif — remove all references

## Color System

Each metric group gets a hue for its card background gradient and border:

| Group               | Hue                      | Cards                                    |
| ------------------- | ------------------------ | ---------------------------------------- |
| Followers / Saves   | `#E8833A` orange         | Hero follower card, avg saves            |
| Engagement / Health | `#4ade80` green          | Eng rate card, health ring, delta badges |
| Reach / Profile     | `#4d7cff` blue           | Reach card, profile views                |
| Shares / Countries  | `#E87FA8` pink           | Avg shares, top countries                |
| Neutral             | `rgba(255,255,255,0.04)` | Posts/week, fallback                     |

Card pattern:

- Background: `linear-gradient(145deg, rgba(hue, 0.15), rgba(hue, 0.03))`
- Border: `1px solid rgba(hue, 0.15-0.2)`
- Border radius: 12-14px
- Label color: the hue itself (not muted gray)

## Layout (top to bottom)

1. **Action bar** — period toggle (Daily/Weekly/Monthly) + Refresh Data + Run Deep Analysis buttons. Full width. Background: gradient orange-to-blue subtle.

2. **Brief + Health** — 2:1 grid. Brief card with orange gradient glow. Health ring on right.

3. **Hero metrics** — 3 columns (2fr 1fr 1fr). Followers card is 2x wide with embedded sparkline bars and green delta badge. Eng Rate and Reach each get their own gradient card with sub-context label.

4. **Secondary metrics** — 4 equal columns. Avg Saves (orange), Avg Shares (pink), Profile Views (blue), Posts/Week (neutral). Each with sub-label ("per post", "7 day", etc).

5. **Demographics inline** — 4 equal columns. Gender (green, mini donut), Age (blue, horizontal bars), Top Cities (orange, ranked list), Top Countries (pink, ranked list). Each is a compact card with its color identity.

6. **Insights** — 3 columns. What's Working (green left-border), What's Not (red left-border), Do This Week (orange left-border). Body text in PP Mori 11-12px.

7. **Growth chart + Momentum** — 2:1 grid. Growth chart (existing SVG component, restyled). Momentum gauge on right (existing component, restyled with Inter 800 number).

8. **Reach mix bar** — Full width. Follower vs non-follower horizontal split bar.

9. **Heatmap** — Full width. Existing FollowerActivityHeatmap component (already working).

10. **Post attribution** — Full width. Existing FollowerPostAttribution table (already working).

11. **Recent posts strip** — Full width. Existing thumbnail strip.

12. **Brand scheme** — Existing BrandSchemeSection.

13. **Content ideas + Creator matches + Campaign ops** — 3-column row (existing).

14. **Campaigns list** — Existing campaigns section.

## Components to Modify

### BrandOsDashboard.svelte

- Replace all `'Bodoni Moda'` with `'Inter', 'Geist Variable', sans-serif`
- Increase stat number font-weight from 700 to 800
- Increase hero number font-size from 24px to 36px (followers) and 28px (eng rate, reach)
- Add gradient backgrounds to `.bs-metric` cards per color system
- Add colored borders per color system
- Brighten `.bs-label` color from `#4A4A50` to the card's hue color
- Add delta badge styling (green chip with +N)
- Add sub-context labels under numbers ("per post", "Live from IG", "148 interactions")

### FollowerAnalyticsPanel.svelte

- Remove the panel's own header/action bar (dashboard already has one)
- Remove the separate summary cards row (metrics are now in BrandOsDashboard)
- Keep: demographics inline row, growth chart, momentum, reach mix, heatmap, post attribution
- Restyle demographics to use color-coded 4-column card layout
- Restyle `.fa-stat-num` from Bodoni to Inter 800

### Portal page (brands/portal/+page.svelte)

- Remove `portalTab === 'followers'` conditional — follower analytics components render inline in content tab
- Remove FollowerAnalyticsPanel wrapper — instead render individual components directly in the content tab flow
- Order: BrandOsDashboard → Demographics row → Growth+Momentum → Reach mix → Heatmap → Post attribution → Recent posts → Campaigns

### Brand layout (+layout.svelte)

- Remove "Follower Analytics" from sidebar nav sections
- Renumber remaining sections

## Components to Keep As-Is

- FollowerGrowthChart.svelte (restyle card wrapper only)
- FollowerMomentum.svelte (change Bodoni to Inter, restyle card)
- FollowerActivityHeatmap.svelte (working, just restyle card wrapper)
- FollowerPostAttribution.svelte (working, just restyle card wrapper)
- BrandSchemeSection.svelte

## Components to Modify Lightly

- FollowerDemographics.svelte — change from 2x2 grid to 4-column inline row, apply color system per quadrant
