# Landing Page + Swiss Legal Pages — Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Scope:** Public landing page at `/`, bilingual (en/de), Swiss privacy policy at `/privacy`. Existing app moves to `/app`.

## Goals

- Replace the current `/` (project list) with a public marketing landing page that explains what Wohnungs-Plan is and drives users to start a project.
- Add a Swiss-compliant Privacy Policy (Datenschutzerklärung) at `/privacy`.
- Keep the app UX unchanged for logged-in and guest-local users — they just access it at `/app`.

## Out of scope

- Impressum (not required for non-commercial hobby projects in CH).
- Separate Terms of Service.
- Analytics, cookie banner (no non-essential cookies are set).
- Blog, changelog, pricing pages.

## Routing

| Route | Purpose | Auth |
|---|---|---|
| `/` | Landing page; server-side redirect to `/app` if authenticated | Public |
| `/app` | Project list (current `/+page.svelte`) | Public (local projects for guests, cloud for signed-in) |
| `/app/projects/[id]` | Project editor | Public; share tokens still work via existing routes |
| `/app/settings` | Settings | Auth required (existing behaviour) |
| `/privacy` | Privacy policy | Public |
| `/share/[token]`, `/invite/[token]`, `/oauth/*`, `/api/*`, `/.well-known/*`, `/authorize`, `/token` | Unchanged | — |

### Layout restructure

- `src/routes/+layout.svelte` (root) → minimal marketing-neutral layout: theme provider, `<svelte:head>`, Sonner toast, lang switcher logic. No sidebar.
- New `src/routes/app/+layout.svelte` → current app shell (sidebar, etc.). Inherits from root.
- New `src/routes/+page.svelte` → landing page.
- New `src/routes/+page.server.ts` → session check; redirect authenticated users to `/app`.
- `src/routes/privacy/+page.svelte` → privacy page.

### Internal link updates

Grep the codebase for:
- `href="/"`, `href="/projects`, `href="/settings`, `goto('/')`, `goto('/projects`, `goto('/settings`
- Update to `/app`, `/app/projects`, `/app/settings` respectively where they refer to the app.
- The root `/` link (e.g., logo in app header) should point to `/app` when inside the app shell.

## Visual direction: "Blueprint Precision"

Uses existing design tokens (Manrope / Inter / Space Grotesk, surface tiers, no 1px borders).

- **Grid-paper backdrop** in hero section: 8px grid using `surface-container-highest` lines at low opacity, fades to transparent at edges.
- **Section dividers:** tonal layering (`surface` ↔ `surface-container-low`), never `border-t`.
- **Technical callouts** in Space Grotesk: `A-01 · HERO`, `A-02 · FEATURES` top-left of section mockups, small uppercase with letter-spacing.
- **Dimension labels** on illustrative floorplans: `4.80m × 3.20m` etc.
- **Motion:** entry fade-in, hero mockup has subtle "pieces snap in" animation on load (staggered 80ms). All motion gated on `prefers-reduced-motion: reduce`.
- **Feature cards:** `surface-container-highest`, `rounded-lg` (8px), no borders, line-art icons (1.5px stroke).
- **CTA buttons:** follow existing `Button` variants (primary uses gradient per design system).

## Landing page sections

### Header (sticky, glassmorphism)

- Logo + "Wohnungs-Plan" wordmark → links to `/`
- Right: language switcher (EN/DE), secondary "Sign in" link, primary "Open app" button (→ `/app`)
- On mobile: collapses to logo + hamburger with the same links.

### 1. Hero (`A-01 · HERO`)

- Layout: 60/40 split on desktop (text left, mockup right). Mobile: stacked.
- **Headline:** "Plan your apartment." (Manrope, -0.02em, huge — responsive clamp).
- **Subhead:** "Upload a floorplan. Drag furniture. See what fits — together."
- **CTAs:** Primary "Start planning" → `/app`; secondary ghost "View on GitHub" → repo.
- **Mockup:** SVG mini-canvas. White card over grid backdrop. Walls drawn as 1.5px strokes. 2-3 furniture pieces (sofa, table, chair) animate in on load with staggered delay. Dimension labels appear after pieces settle. One subtle collaborator cursor ghost hovers over a piece.
- **Small technical label:** `A-01 · HERO · LIVE` in Space Grotesk.

### 2. Feature strip (`A-02 · FEATURES`)

Four cards in a grid, 2x2 on tablet, 4x1 on desktop, 1x4 on mobile. Each card:
- Line-art icon (Lucide, 1.5px stroke)
- Short heading (Manrope semibold)
- 1-2 sentence description (Inter)

Features:
1. **Real-time collaboration** — "See others' cursors. Edit together. No merge conflicts."
2. **Branches & variants** — "Compare layouts side by side. Iterate without losing work."
3. **AI floorplan analysis** — "Let AI agents read your floorplan and place furniture for you."
4. **Share with anyone** — "Public links, password protection, viewer/editor roles."

### 3. How it works (`A-03 · WORKFLOW`)

Three horizontal steps on desktop, stacked on mobile. Each has a mini-illustration (SVG), numbered (`01`, `02`, `03` in Space Grotesk), heading, short description.

1. **Upload your floorplan** — drag an image or PDF export.
2. **Calibrate the scale** — drop two points on a known dimension.
3. **Drag furniture in** — add items with real dimensions, snap to the grid, share the result.

### 4. Secondary features row (`A-04 · MORE`)

Compact horizontal list — icon + label + one-line description for:
- Offline / PWA
- Comments & discussion
- Import / export JSON

### 5. Final CTA

- Centered. "Start planning your space." Subtext: "Free. Open source. Made in Switzerland."
- Primary button "Open the app" → `/app`.

### 6. Footer

- Left: logo + tagline + "MIT licensed" text
- Right (columns):
  - **Product:** Open app, GitHub
  - **Legal:** Privacy
  - **Language:** EN / DE toggle
- Bottom: "© 2026 · Made in Switzerland" + version hash (build-time injected)

## i18n

- All strings in `messages/en.json` and `messages/de.json`.
- Namespace prefix: `landing_*` (e.g., `landing_hero_headline`, `landing_feature_collab_title`).
- Privacy policy content split by section: `privacy_*` keys OR (simpler) stored as two top-level keys `privacy_body_en`/`privacy_body_de` rendered as markdown-lite. **Decision:** use structured per-section keys so translators can diff easily. Headings and paragraphs each get a key.

## Privacy Policy content

Adapted from the Bissbilanz template; effective date **2026-04-16**.

Sections:

1. **Intro** — personal hobby project; what the policy covers.
2. **What data is collected:**
   - Account info from Infomaniak OIDC: name, email.
   - Projects: floorplans (image files), furniture items (dimensions, colors, prices, URLs, photos), branches, comments, share-link metadata.
   - Uploaded image files (floorplan images, furniture photos) stored on server filesystem.
   - OAuth/MCP grants (for AI agents you authorize).
   - Session cookie.
3. **What is NOT collected:** location, device identifiers, usage analytics, ad data.
4. **How data is used:** provide the app functionality only; never sold, never used for ads.
5. **Storage:** self-hosted PostgreSQL in Switzerland; encrypted HTTPS transport; uploaded images on server filesystem.
6. **Third-party services:** Infomaniak OIDC (Swiss, FADP-subject). No analytics, no crash reporting, no ads.
7. **Collaboration & sharing:** when you invite members or publish share links, the data you've placed in that project becomes visible to those recipients. Public share links can be password-protected at your option.
8. **Real-time collaboration:** cursor positions and edits are broadcast to project members over WebSockets while they are connected; positions are not stored.
9. **OAuth / AI agents:** tokens you grant allow third-party clients to act on your data. Revoke anytime in settings.
10. **Offline projects:** local projects stay in your browser's IndexedDB; never sent to the server unless you explicitly sync.
11. **Retention & deletion:** data kept while your account exists; deletion request via GitHub issue.
12. **Children:** not directed at <13.
13. **Changes:** updated here with new effective date.
14. **Contact:** "Open an issue on GitHub" with link.

Rendered as a styled long-form page using the Blueprint Precision aesthetic: Manrope h1/h2, Inter body, surface-container-low panel, `A-P1 · PRIVACY POLICY` technical callout, max-width ~70ch for readability.

## Mobile

- Hero stacks; mockup shrinks to full-width below text.
- Feature grid becomes single-column.
- How-it-works stacks vertically with left-side number labels.
- Header shrinks; "Open app" CTA stays visible.

## Accessibility

- WCAG AA contrast (existing tokens already satisfy this).
- Keyboard-navigable, visible focus states.
- `prefers-reduced-motion` disables entry animations.
- Images have alt text.
- Lang switcher updates `<html lang>` via Paraglide runtime.

## Build sequence

1. Move app routes into `/app` directory; update internal links.
2. Split root `+layout.svelte` vs new `/app/+layout.svelte`.
3. Add `+page.server.ts` redirect for authenticated users on `/`.
4. Build landing page sections (new components under `src/lib/components/landing/`).
5. Add i18n keys for landing + privacy.
6. Build `/privacy` page.
7. Verify `bun check` and `bun build` pass; manual browser smoke test en + de.
