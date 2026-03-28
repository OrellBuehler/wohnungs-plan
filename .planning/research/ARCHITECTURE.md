# Architecture Research: UX Polish Milestone

**Research Date:** 2026-02-17
**Scope:** How i18n (Paraglide), mobile UX improvements, design system polish, and error handling integrate with the existing SvelteKit 2 + Svelte 5 floorplanner architecture.

---

## Summary

The four UX-polish dimensions (i18n, mobile UX, visual design, error handling) each touch different layers of the existing architecture. They share no database schema changes — all changes are UI-layer and build-time. They can be sequenced to minimize risk: infrastructure first (i18n wiring, error patterns), then visible polish (design, mobile), then bulk string extraction. Each dimension is largely independent once i18n infrastructure is in place.

---

## Component Boundaries

### Existing Architecture (Relevant Layers)

```
┌─────────────────────────────────────────────────────┐
│  Build / Vite                                       │
│  vite.config.ts — plugins: tailwindcss, sveltekit   │
│  svelte.config.js — adapter, PWA plugin             │
└──────────────────┬──────────────────────────────────┘
                   │ compile time
┌──────────────────▼──────────────────────────────────┐
│  Server Middleware (src/hooks.server.ts)             │
│  • Session parsing                                  │
│  • CORS / CSRF                                      │
│  • Migration runner (init())                        │
└──────────────────┬──────────────────────────────────┘
                   │ every request
┌──────────────────▼──────────────────────────────────┐
│  Routes (src/routes/)                               │
│  • +layout.svelte — root HTML shell, AppSidebar,    │
│    Tooltip.Provider, 100dvh container               │
│  • +page.svelte (home) — project list               │
│  • projects/[id]/+page.svelte — main editor         │
│    (1195 lines, isMobile detection lives here)      │
└──────────────────┬──────────────────────────────────┘
                   │ props / store reads
┌──────────────────▼──────────────────────────────────┐
│  Feature Components (src/lib/components/)           │
│  canvas/, items/, comments/, sharing/, layout/,     │
│  collaboration/, projects/, auth/                   │
│  • Receive readonly, hidePositionFields props       │
│  • Local $state for loading/error display           │
└──────────────────┬──────────────────────────────────┘
                   │ store reads / async calls
┌──────────────────▼──────────────────────────────────┐
│  Stores (src/lib/stores/*.svelte.ts)                │
│  • project.svelte.ts — items, branches, floorplan   │
│  • auth.svelte.ts — user, isLoading                 │
│  • comments.svelte.ts                               │
│  • collaboration.svelte.ts                          │
│  • sync.svelte.ts — offline queue                   │
└─────────────────────────────────────────────────────┘
```

### New Boundaries Introduced by UX Polish

#### i18n (Paraglide)

```
┌──────────────────────────────────────────────┐
│  messages/en.json, messages/de.json          │
│  (source of truth for all UI strings)        │
└─────────────────┬────────────────────────────┘
                  │ compiled by
┌─────────────────▼────────────────────────────┐
│  src/lib/paraglide/ (generated, gitignored)  │
│  • runtime.js — setLocale(), getLocale()     │
│  • server.js — paraglideMiddleware()         │
│  • messages/en.js, messages/de.js            │
└─────────┬───────────────┬────────────────────┘
          │               │
          │               │ middleware
┌─────────▼───┐   ┌───────▼────────────────────┐
│ Components  │   │ hooks.server.ts             │
│ import m.*  │   │ sequence(paraglideHandle,   │
│ functions   │   │          appHandle)         │
└─────────────┘   └────────────────────────────┘
```

Paraglide is a **build-time compiler**: it reads `messages/*.json`, generates typed message functions into `src/lib/paraglide/`, and tree-shakes unused messages from the bundle. The server middleware runs first in the `sequence()` chain to detect locale from cookie/Accept-Language, inject it into the request, and patch `%lang%` into the HTML `lang` attribute. Components import `* as m from '$lib/paraglide/messages'` and call `m.some_key()` — no runtime lookup table, just function calls.

#### Mobile UX

The mobile boundary already exists: `isMobile` boolean in `projects/[id]/+page.svelte`, propagated downward as `readonly` and `hidePositionFields` props. The pattern is established and complete for the core editor. Remaining gaps:

- History page (`projects/[id]/history/+page.svelte`) has no mobile detection
- Settings pages (`settings/general`, `settings/mcp`) have no mobile-specific layout
- Share page (`share/[token]`) uses matchMedia but may have layout issues

#### Error Handling

Currently errors are handled ad-hoc per component:

- Home page: `error = $state<string | null>(null)`, shown as red text with a Retry button
- Stores: `console.error()` and return `null`/`false` on failure
- API routes: `throw error(status, message)` (SvelteKit), try/catch per handler

No global toast system exists. No global error boundary exists. SvelteKit's `+error.svelte` route handler is absent (unhandled errors fall through to SvelteKit's default error page).

#### Visual Design (Design System)

All styling uses Tailwind CSS 4 + shadcn-svelte components. No global design token file exists beyond Tailwind's config and CSS variables defined in `src/app.css`. Visual polish is purely CSS-layer with no architecture changes required — changes are made directly in component templates.

---

## Data Flow

### i18n Data Flow

```
Request arrives
    │
    ▼
paraglideMiddleware(event.request, ...)
    │
    ├─ reads Cookie: PARAGLIDE_LOCALE=de  (or Accept-Language header)
    ├─ resolves locale = 'de' | 'en'
    ├─ mutates event.request (locale attached)
    └─ calls resolve(event, { transformPageChunk: html.replace('%lang%', locale) })
                                │
                                ▼
                    SSR renders component tree
                    Components call m.key_name()
                    Paraglide runtime returns
                    correct locale string
                                │
                                ▼
                    HTML response with lang="de"
                    and translated strings baked in

Language switcher interaction (client-side):
    User selects "Deutsch"
    → LanguageSwitcher calls setLocale('de')
       (sets PARAGLIDE_LOCALE cookie)
    → SvelteKit invalidates, re-renders with new locale
```

**Key point:** Locale state lives in a cookie, not in a Svelte store. `setLocale()` sets the cookie and triggers re-navigation. SSR re-renders pick up the new locale automatically. No store needs updating.

### Mobile UX Data Flow

```
onMount in projects/[id]/+page.svelte
    │
    ▼
window.matchMedia('(max-width: 767px)')
    │
    ▼
isMobile = $state(boolean)
    │
    ├──────────────────────────────┐
    │                             │
    ▼                             ▼
FloorplanCanvas               ItemList
  readonly={isMobile}           readonly={isMobile}
    │                             │
    ▼                             ▼
Disables drag/rotate          Hides "Place Item" button
Fires onItemSelect → ItemBottomSheet
    │
    ▼
ItemForm
  hidePositionFields={isMobile}
    │
    ▼
updateItem() — store mutation, unchanged
```

**Key point:** Mobile detection is a presentation-layer concern only. The store, API routes, and server are unaware of mobile state. `isMobile` flows top-down as props; no store needed.

### Error Handling Data Flow (Target Pattern)

```
Store action (e.g., addItem())
    │
    ├── try: POST /api/projects/[id]/items
    │         │
    │         └── success → update local state, return item
    │
    └── catch → console.error() AND
                return null/false AND
                (new) emit error event or return { error: string }
                    │
                    ▼
              Component receives error signal
                    │
                    ▼
              (new) toast('Failed to save item', { type: 'error' })
                    │
                    ▼
              Toast renders in +layout.svelte (top-level)
```

To add a toast system, a `<Toaster />` component needs to mount once in `src/routes/+layout.svelte`. shadcn-svelte includes a Sonner integration via `bunx shadcn-svelte@latest add sonner`. The toast store/function is then importable anywhere.

### Visual Design Data Flow

Design changes are entirely local to components — no data flows involved. Changes affect:

- Tailwind class strings in `.svelte` templates
- CSS variables in `src/app.css` (affects all components globally)
- shadcn-svelte component overrides in `src/lib/components/ui/`

---

## Integration Points: How Each Dimension Connects

### i18n Integration Points

**1. `vite.config.ts`** — Add `paraglideVitePlugin()` before or after `sveltekit()`:

```typescript
import { paraglideVitePlugin } from '@inlang/paraglide-js';
plugins: [
	tailwindcss(),
	sveltekit(),
	paraglideVitePlugin({
		project: './project.inlang',
		outdir: './src/lib/paraglide',
		strategy: ['cookie', 'preferredLanguage', 'baseLocale']
	})
];
```

**2. `src/hooks.server.ts`** — Wrap existing `handle` with `sequence()`:

```typescript
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';

const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale)
		});
	});

// Rename existing export to appHandle:
export const handle = sequence(paraglideHandle, appHandle);
```

The existing CSRF, CORS, and session logic in `appHandle` is untouched. Paraglide runs before it, which is correct — locale detection has no security implications and can run before session parsing.

**3. `src/app.html`** — Change `lang="en"` to `lang="%lang%"` so the middleware can inject the correct locale.

**4. `project.inlang/settings.json`** — New file declaring locales and message format plugin.

**5. `messages/en.json`, `messages/de.json`** — New files. Flat `snake_case` keys with area prefix (e.g., `common_cancel`, `item_form_title_edit`). Parameters use `{name}` syntax.

**6. Each component** — Replace hardcoded strings: `import * as m from '$lib/paraglide/messages'`, then `{m.item_form_title_edit()}`.

**7. New `LanguageSwitcher.svelte`** (`src/lib/components/layout/`) — shadcn Select with `setLocale()` on change. Added to `AppSidebar.svelte` footer and `settings/general/+page.svelte`.

**Critical constraint:** The generated `src/lib/paraglide/` directory must be added to `.gitignore` and regenerated on build. It is produced by the Vite plugin, not committed.

### Mobile UX Integration Points

The foundation is already built (`isMobile`, `readonly` props, `ItemBottomSheet`, matchMedia). Remaining integration points for further improvements:

**1. History page** (`src/routes/projects/[id]/history/+page.svelte`) — Needs mobile detection added if table layout needs to collapse to cards on mobile.

**2. Settings pages** — Currently desktop-oriented forms. Should be verified for usability at 375px viewport, adding `stack` layout if horizontal fields break.

**3. Safe area insets** — Already applied in `MobileNav.svelte` and header. Verify any new bottom-positioned elements (toasts, dialogs) use `pb-safe` or `env(safe-area-inset-bottom)`.

**4. Touch target rule** — All interactive elements must be `min-h-11` (44px). Currently enforced in `ItemBottomSheet` but not systematically checked elsewhere.

### Error Handling Integration Points

**1. `src/routes/+layout.svelte`** — Add `<Toaster />` once at the root. This is the only component mounting point needed:

```svelte
<script>
	import { Toaster } from '$lib/components/ui/sonner';
</script>

<!-- Inside the root div: -->
<Toaster />
```

**2. Store actions** — Existing pattern is `console.error()` and return null. Enhance by also calling `toast.error(message)` from `svelte-sonner`. Since stores are `.svelte.ts` files (not server files), they can import from client-side modules.

**3. API route errors** — Already return proper HTTP status codes. Client-side `authFetch` (in stores) should handle non-2xx responses by reading the response body for an error message before throwing.

**4. SvelteKit error page** — Add `src/routes/+error.svelte` to catch unhandled route errors (404, 500 from load functions) with a user-friendly message and navigation back to home.

**5. Empty states** — Not a new component needed; inline in existing templates. Pattern: when data array is empty and not loading, show centered text + icon + CTA button.

### Visual Design Integration Points

**1. `src/app.css`** — Global CSS variables for color tokens, spacing scale. Changes here affect all components.

**2. shadcn-svelte component overrides** — Components in `src/lib/components/ui/` are locally owned. Direct edits are fine — these aren't updated from upstream.

**3. Tailwind class updates in templates** — Systematic pass through components to apply consistent spacing, typography scale, and color usage.

No new components or files needed for design polish — it's a template-editing pass.

---

## Suggested Build Order

Dependencies between dimensions determine sequencing:

### Phase 1: i18n Infrastructure (prerequisite for string extraction)

**Why first:** Every other component touched for mobile/design/error polish will also need strings replaced. Doing infrastructure setup first means the string extraction can happen as part of the same component edits.

1. Install `@inlang/paraglide-js` with bun
2. Create `project.inlang/settings.json`
3. Create `messages/en.json` (empty or minimal), `messages/de.json`
4. Add `paraglideVitePlugin` to `vite.config.ts`
5. Update `src/app.html` (`lang="%lang%"`)
6. Update `src/hooks.server.ts` (`sequence(paraglideHandle, appHandle)`)
7. Add `src/lib/paraglide/` to `.gitignore`
8. Verify: `bun dev` starts, app loads in English, `bun check` passes
9. Create `LanguageSwitcher.svelte`, add to sidebar

**Dependency:** All subsequent phases can run in parallel after Phase 1 is complete, since they each operate on different component files.

### Phase 2A: Error Handling Foundation (independent of i18n completion)

**Why early:** Toast system is used by other components. Setting it up first means all subsequent component touches can include toast calls.

1. `bunx shadcn-svelte@latest add sonner`
2. Add `<Toaster />` to `src/routes/+layout.svelte`
3. Add `src/routes/+error.svelte` (route error boundary)
4. Identify the 5-6 most critical user-facing actions (save item, delete project, upload floorplan) — add `toast.error()` calls to their catch blocks in stores/components
5. Standardize empty-state pattern in home page and item list

### Phase 2B: String Extraction (bulk work, can parallelize with 2A)

**Recommended order within extraction:**

1. Layout + Navigation first (AppSidebar, MobileNav) — high visibility, shared by all pages
2. Home page — simple page, good smoke test
3. items/ components — ItemForm, ItemList, ItemCard, ItemBottomSheet
4. canvas/ components
5. projects/[id]/+page.svelte — largest file, do last so sub-components are already done
6. Sharing, comments, settings, OAuth pages
7. Complete German translations in `messages/de.json`

### Phase 2C: Mobile UX Improvements (independent of i18n)

**Verify and fix:**

1. History page mobile layout
2. Settings page responsiveness
3. Safe-area inset audit (new toasts, any new bottom elements)
4. Touch target audit across all interactive elements
5. Any missing mobile states (loading spinners on mobile interactions)

### Phase 3: Visual Design Polish (last — touches same files as above)

**Why last:** Design polish edits the same component templates being touched in phases 2A-2C. Doing it last avoids merge conflicts and means the final component state gets the design pass.

1. Establish/verify CSS token conventions in `app.css`
2. Typography scale pass (heading sizes, body text, labels)
3. Color consistency pass (button variants, status colors, backgrounds)
4. Spacing consistency pass (padding, gaps, margins)
5. Component-level polish (card hover states, form field focus rings, empty state illustrations)

---

## Key Constraints and Risks

### i18n

- **Paraglide generates to `src/lib/paraglide/`** — this directory must be created by the build. New developers and CI must run `bun dev` or `bun build` before `bun check` succeeds, because `svelte-check` needs the generated types. Add a note to project setup docs.
- **Cookie strategy means no SSR locale mismatch** — the middleware runs server-side and sets the locale before rendering, so hydration won't differ from SSR output. This is correct.
- **`sequence()` order matters** — Paraglide handle must run before `appHandle` (session parsing). If reversed, `event.request` modifications from Paraglide would come after CSRF checks, causing subtle bugs.
- **Service worker caching** — Vite hash-based filenames handle cache-busting for locale-specific JS bundles. No service worker changes needed.
- **MCP/API endpoints** — Server-side API routes don't render HTML, so they don't call message functions. i18n is purely a UI-layer concern.

### Mobile UX

- **`isMobile` is page-local, not global** — Each page that needs mobile adaptation must independently set up matchMedia. The pattern is established in `projects/[id]/+page.svelte`. Copy it where needed rather than creating a global store (viewport state in a store causes hydration issues).
- **`readonly` prop threading** — If new sub-components are added between the page and the canvas/list, the `readonly` prop must be threaded through. Keep the prop interface explicit.
- **Canvas is not mobile-editable** — FloorplanCanvas already accepts `readonly`. Do not attempt drag/drop touch gestures on canvas; the existing tap-to-open-bottom-sheet is the correct mobile pattern.

### Error Handling

- **Toast in stores** — Stores are `*.svelte.ts` files and run client-side. Importing `toast` from `svelte-sonner` is fine in stores. However, avoid toast calls in any code path that also runs server-side (SSR); stores are client-only, so this is not an issue.
- **Store actions return `null`/`false` on error** — This is the existing contract. Components that currently ignore the return value need to be updated to check it before adding toast calls. Otherwise, a double-notification could occur (store logs, component silently re-renders unchanged).
- **`+error.svelte`** — SvelteKit's error page catches errors thrown by `load()` functions in `+page.server.ts`. Currently no `+page.server.ts` files exist (data loads happen in `onMount`), so `+error.svelte` catches only navigation-level errors (404, thrown `error()`). This is still worth adding.

### Visual Design

- **Tailwind CSS 4** — Uses CSS `@theme` directive, not `tailwind.config.js`. Custom tokens go in `src/app.css` under `@theme { --color-...: ... }`. The existing `app.css` structure should be checked before adding new variables.
- **shadcn-svelte components** — Locally owned, safe to edit. Adding new components via `bunx shadcn-svelte@latest add` regenerates only that component file; it does not overwrite customized ones.
- **No design token library** — There is no design token system (no Figma tokens, no style-dictionary). Tokens are Tailwind CSS variables only. Keep changes in `app.css` and Tailwind classes; avoid hardcoded hex values in component templates.

---

## Where New Code Lives

| Concern                     | Location                                                |
| --------------------------- | ------------------------------------------------------- |
| Paraglide config            | `project.inlang/settings.json`                          |
| Message files               | `messages/en.json`, `messages/de.json`                  |
| Generated paraglide         | `src/lib/paraglide/` (gitignored)                       |
| Language switcher component | `src/lib/components/layout/LanguageSwitcher.svelte`     |
| Toast (Sonner) component    | `src/lib/components/ui/sonner.svelte` (added by shadcn) |
| Route error boundary        | `src/routes/+error.svelte`                              |
| CSS token additions         | `src/app.css`                                           |
| Middleware changes          | `src/hooks.server.ts`                                   |
| Build config changes        | `vite.config.ts`                                        |

No new stores, no new API routes, no database schema changes are needed for this milestone.

---

## Component Interaction Map

```
vite.config.ts
  └─ paraglideVitePlugin (compile time)
       └─ generates src/lib/paraglide/ (types, runtime, messages)

src/hooks.server.ts
  └─ sequence(paraglideHandle, appHandle)
       ├─ paraglideHandle: locale detection → cookie read/write
       │    └─ sets lang attribute in HTML via transformPageChunk
       └─ appHandle: CSRF, CORS, session parsing (unchanged)

src/routes/+layout.svelte
  ├─ root HTML shell (100dvh, bg-slate-100)
  ├─ AppSidebar (contains LanguageSwitcher — NEW)
  └─ Toaster (NEW — renders toast notifications)

src/routes/+error.svelte (NEW)
  └─ catches unhandled SvelteKit route errors

src/routes/+page.svelte (home)
  ├─ uses m.* for strings
  ├─ error state → toast.error() on load failure
  └─ empty state with CTA when no projects

src/routes/projects/[id]/+page.svelte
  ├─ isMobile via matchMedia
  ├─ uses m.* for strings (many replacements needed)
  └─ passes readonly, hidePositionFields to children

src/lib/components/layout/
  ├─ AppSidebar.svelte → uses m.*, contains LanguageSwitcher
  ├─ MobileNav.svelte → uses m.* for tab labels
  └─ LanguageSwitcher.svelte (NEW) → calls setLocale()

src/lib/components/items/
  ├─ ItemForm.svelte → uses m.*, hidePositionFields prop
  ├─ ItemList.svelte → uses m.*, readonly prop
  ├─ ItemCard.svelte → uses m.*
  └─ ItemBottomSheet.svelte → uses m.*

src/lib/components/canvas/
  ├─ FloorplanCanvas.svelte → readonly prop, no string extraction needed (canvas, no text)
  ├─ FloorplanUpload.svelte → uses m.*
  ├─ ScaleCalibration.svelte → uses m.*
  └─ CanvasControls.svelte → uses m.*

src/lib/stores/
  ├─ project.svelte.ts → add toast.error() to catch blocks
  └─ auth.svelte.ts → add toast.error() to catch blocks
```

---

_Research: 2026-02-17_
