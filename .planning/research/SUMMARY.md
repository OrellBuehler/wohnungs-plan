# Project Research Summary

**Project:** Wohnungs-Plan — UX Polish Milestone
**Domain:** SvelteKit 2 + Svelte 5 floorplanner PWA (i18n, mobile UX, visual design, error/loading states)
**Researched:** 2026-02-17
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone adds four cross-cutting polish layers to an existing, production-ready floorplanner PWA: internationalization (English + German), mobile UX hardening, visual design consistency, and systematic error/loading state coverage. The codebase is already well-structured — 127 Svelte files, a working mobile pass, Svelte 5 runes throughout, and Tailwind CSS 4 with shadcn-svelte. No new architectural layers are needed. The entire milestone is UI-layer and build-time work with zero database schema changes.

The recommended approach is to sequence these four dimensions strategically rather than tackling them in parallel. Paraglide JS v2 (`@inlang/paraglide-js`) and the Sonner toast component must be wired up first because every subsequent component edit will need both. Paraglide's Vite plugin compiles typed message functions at build time, keeping bundle size minimal and eliminating runtime lookup overhead. The cookie-based locale strategy (no URL prefixing) fits the existing architecture without route restructuring. Once infrastructure is in place, the remaining bulk work — string extraction, mobile audits, visual polish — can proceed in any order since each operates on different component files.

The primary risks are not technical: they are process risks. The 127-file surface area makes it easy to miss non-visible strings (Konva canvas text, `aria-label`, `placeholder` attributes), leave `toLocaleDateString()` calls locale-unaware, and accidentally surface untranslated `Error.message` strings in toasts. The key mitigation is a per-component extraction checklist with explicit steps for accessibility attributes and canvas text. Secondary risks involve iOS mobile specifics: `dvh` + virtual keyboard interaction and the pointer-cancel/screen-lock sequence on the canvas. These require real-device testing, not emulator testing.

---

## Key Findings

### Recommended Stack

The only new runtime dependency is `@inlang/paraglide-js` v2.11.0. The old SvelteKit-specific adapter (`@inlang/paraglide-sveltekit`) is deprecated at v0.16.1 and must not be used. For UI components, `shadcn-svelte skeleton` and `shadcn-svelte sonner` are added via `bunx shadcn-svelte@latest add` — these copy source into `$lib/components/ui/` and add no runtime dependencies beyond the already-installed `svelte-sonner`. All mobile gesture work uses Konva's native touch API (no new gesture library). All mobile layout work uses CSS environment variables and Web APIs (no new libraries).

**Core technologies:**

- `@inlang/paraglide-js` v2.11.0: compiler-based i18n — tree-shakes unused messages, type-safe keys, official SvelteKit recommendation; replaces deprecated `@inlang/paraglide-sveltekit`
- `shadcn-svelte sonner` (wraps `svelte-sonner` v1.0.5): toast notifications — Svelte 5 rune-compatible, matches existing design system; add once to `+layout.svelte`, call `toast.*()` anywhere
- `shadcn-svelte skeleton`: loading skeleton component — uses `animate-pulse` from already-installed `tw-animate-css`; no new dependency
- Konva native touch events: pinch-zoom and mobile gestures — 20-line DIY pattern; avoid gesture library conflicts

### Expected Features

**Must have (table stakes):**

- All UI strings translated with no raw English visible in the German UI — users leave immediately if language is mixed
- Language switcher visible in sidebar and settings — needed to test translations; use native language names ("Deutsch")
- Locale persists across sessions via cookie — cookie strategy already chosen; survives browser refresh
- Number/measurement formatting per locale — decimal comma in German (`3,5 m`); affects all dimension displays
- Touch targets 44px minimum on all interactive elements — partially done; needs systematic audit
- No content cut off by mobile browser chrome — `100dvh` applied on project page; verify all routes
- Loading skeletons instead of blank flashes — project list currently has a blank flash
- Every API error surfaces to the user — many `void fetch()` calls currently fail silently
- Confirmation dialogs for destructive actions using shadcn Dialog, not native `confirm()`
- Saving/sync indicator in header — plan already exists at `docs/plans/2026-02-02-toast-and-saving-indicator.md`

**Should have (competitive):**

- Automatic browser language detection via `Accept-Language` header (Paraglide `preferredLanguage` strategy)
- Haptic feedback on canvas item tap/select (`navigator.vibrate(10)`) — low effort, high perceived quality
- Offline indicator banner when `navigator.onLine` is false — high trust signal for PWA
- Photo capture button for item images via `<input capture="environment">` — zero extra code, high value
- Retry button on error toasts for save operations
- Skeleton screens for item list, history, share dialog — beyond project list
- Canvas error boundary with `<svelte:boundary>` — Konva errors can take down the entire canvas
- Empty states with icon + explanation text + CTA on all screens

**Defer to later milestones:**

- Dark mode — major audit of all components required; explicitly out of scope
- RTL layout support — not needed for EN/DE
- URL-based locale routing (`/de/...`) — would require restructuring every route; cookie strategy is sufficient
- Undo/redo system — major architectural change; out of scope for polish milestone
- Conflict resolution UI for collaborative editing — requires real-time lock protocol changes
- More than 2 languages — infrastructure supports adding more later

### Architecture Approach

All four dimensions are UI-layer changes. Paraglide adds a Vite plugin (compile time), a server middleware in `hooks.server.ts` (via `sequence()`), and generated typed functions in `src/lib/paraglide/` (gitignored). Sonner adds one `<Toaster />` mount in `+layout.svelte`. Mobile UX follows the established `isMobile` → `readonly` prop pattern already in `projects/[id]/+page.svelte`. Visual polish is a Tailwind class editing pass with no new files. No new stores, no new API routes, no database schema changes are needed.

**Major components modified:**

1. `vite.config.ts` + `hooks.server.ts` — Paraglide plugin and middleware integration
2. `src/routes/+layout.svelte` — `<Toaster />` mount and `LanguageSwitcher` added to `AppSidebar`
3. `src/lib/stores/project.svelte.ts` + `auth.svelte.ts` — `toast.error()` added to all `catch` blocks
4. `messages/en.json` + `messages/de.json` — new message files, all UI strings extracted here
5. All 127 `.svelte` files — string replacement with `m.*()` calls (bulk work)
6. New: `src/lib/components/layout/LanguageSwitcher.svelte` + `src/routes/+error.svelte`

### Critical Pitfalls

1. **Strings in `.svelte.ts` stores are not reactive to locale changes** — Store-set error strings won't re-evaluate on locale switch. Keep user-visible strings in component templates; for store-originated messages (toasts), use error codes mapped to message keys in the component rather than storing `Error.message` strings.

2. **Konva canvas text is invisible to automated string extraction** — `<Text text="..." />` props don't appear in normal HTML; IDE plugins and grep miss them. Audit `FloorplanCanvas.svelte` (1402 lines) and `CommentsLayer.svelte` explicitly. Require a manual locale-toggle + visual canvas check before marking the canvas extraction group complete.

3. **`toLocaleDateString()` calls bypass Paraglide locale** — All `toLocaleDateString(undefined, ...)` and `toLocaleString()` calls in the codebase use browser locale, not the app's cookie locale. Fix when consolidating `formatRelativeTime` (Group M): accept `locale` from `getLocale()` and pass it to all `toLocale*()` calls.

4. **Paraglide middleware ordering can break existing CSRF checks** — `sequence(paraglideHandle, appHandle)` puts Paraglide before CSRF/session logic; this is correct but must be verified. After wiring up, test a form POST to `/settings/mcp` and an OAuth token request immediately to confirm neither returns unexpected 403s.

5. **Canvas pointer state can desynchronize after phone screen lock** — The gesture `Map<pointerId, {x,y}>` and `isPinching` flag are not reset on `visibilitychange`. Add a `document.visibilitychange` handler that resets the pointer Map and `isPinching` when `document.visibilityState === 'hidden'`. Test on real device (iOS Safari + Android Chrome), not emulator.

6. **shadcn-svelte component edits are overwritten by future `add` commands** — Visual polish tweaks to files in `src/lib/components/ui/` will be lost if someone runs `bunx shadcn-svelte@latest add button` in the future. Prefer CSS variable overrides in `app.css` (`--primary`, `--radius`, etc.) over direct component file edits. Where file edits are unavoidable, annotate with `// CUSTOM: <reason>`.

---

## Implications for Roadmap

Based on combined research, the four areas have clear ordering dependencies. Infrastructure must precede bulk work; the toast system should be in place before any component touches; design polish should come last to avoid merge conflicts with component edits from other phases.

### Phase 1: i18n Infrastructure + Toast Foundation

**Rationale:** Two blockers for all subsequent work. Paraglide must be wired before any string extraction can happen — the generated `$lib/paraglide/` types must exist for `bun check` to pass. Sonner must be installed before any error toast work, since it is used across all four polish areas. These two installs together are under 2 hours of work and unblock everything else.

**Delivers:** Working build with Paraglide plugin, locale detection, `%lang%` injection, and a `<Toaster />` in the root layout. Language switcher visible in sidebar. First smoke-test strings translated.

**Addresses:** Locale persistence (cookie strategy), language switcher (table stakes), automatic browser language detection (differentiator), first error toasts for the most critical user-facing actions.

**Avoids pitfalls:** P-I5 (middleware ordering — test form POST immediately after wiring sequence()), P-I7 (key naming convention established before bulk extraction begins).

**Research flag:** Standard pattern — Paraglide and Sonner have thorough official documentation. No further research needed.

### Phase 2: String Extraction (bulk i18n work)

**Rationale:** After infrastructure exists, string extraction is systematic per-file work. The recommended order (layout/nav first, then home, items, canvas, project page, supporting pages) follows component visibility — highest-traffic components get translated first, enabling German testing before the full pass is complete.

**Delivers:** All UI strings in `messages/en.json` with corresponding `messages/de.json` translations. German UI fully usable. `bun check` passing with type-safe message calls throughout.

**Addresses:** Complete German translation (table stakes), pluralization, date/number locale formatting, accessibility attributes translated, form validation messages translated.

**Avoids pitfalls:** P-I1 (strings in stores — use error codes, not messages), P-I2 (Konva canvas — explicit audit + visual check required), P-I3 (date formatting — Group M consolidation passes `getLocale()`), P-I4 (aria-label/placeholder — added to per-component checklist), P-E1 (Error.message in toasts — use discriminated error codes).

**Research flag:** Standard pattern — well-documented extraction process. The Group M (relative time utility) consolidation step has one non-obvious detail: `toLocaleString()` locale argument. No further research needed.

### Phase 3: Error Handling + Loading States

**Rationale:** Can run in parallel with Phase 2 since it touches stores and layout rather than per-component string content. Should complete before visual polish so error states can be styled consistently in Phase 4.

**Delivers:** No silent failures — all API errors surface as toasts. Saving/sync indicator. Upload progress spinner. Confirmation dialogs using shadcn Dialog. `+error.svelte` route error boundary. Canvas `<svelte:boundary>` error boundary. Loading skeletons for project list.

**Addresses:** Upload progress (table stakes), network error visibility (table stakes), optimistic update rollback, 401 mid-session handling, project load failure retry CTA.

**Avoids pitfalls:** P-V5 (optimistic updates hiding errors — audit all catch blocks in `project.svelte.ts` before polish), P-E3 (stale error states — clear on next successful call; add Retry actions), P-E2 (new empty-state components added to i18n extraction queue same day).

**Research flag:** Standard pattern for toast integration. One area needing attention: upload progress via `fetch` does not expose progress events — requires XHR or Streams API. Assess feasibility before committing to granular progress (a simple spinner is acceptable fallback).

### Phase 4: Mobile UX Hardening

**Rationale:** Mobile audit can run after error handling and in parallel with visual polish. Both mobile and visual polish touch the same component templates, so sequencing them avoids merge conflicts — complete mobile audit before the final visual polish pass.

**Delivers:** 44px touch targets audited and fixed across all interactive elements. Virtual keyboard handling on iOS. Safe-area inset verification for new toast/dialog elements. Haptic feedback on canvas item select. Offline indicator. Photo capture button. History and settings pages verified at 375px.

**Addresses:** Touch targets (table stakes), keyboard/chrome overlap (table stakes), landscape orientation (table stakes), haptic feedback (differentiator), photo capture (differentiator), offline indicator (differentiator).

**Avoids pitfalls:** P-M1 (screen lock pointer desync — `visibilitychange` reset), P-M2 (Android long-press context menu — `oncontextmenu preventDefault`), P-M3 (bottom sheet / canvas touch conflict — `touch-action: pan-y` on sheet content), P-M4 (keyboard + dvh — `overflow-y: auto` inside sheet, `scrollIntoView` on focus), P-M5 (Tailwind classes don't apply to Konva elements — use `{#if mobileMode}` guard).

**Research flag:** Real-device testing required. iOS Safari virtual keyboard and `dvh` behavior and the Konva pointer-cancel/visibilitychange sequence cannot be reliably reproduced in browser emulation. Budget time for device testing in this phase.

### Phase 5: Visual Design Polish

**Rationale:** Last because it edits the same component templates being touched in Phases 2-4. Doing it last means the final component state gets the design pass with no subsequent edits to overwrite it.

**Delivers:** Consistent 4px/8px spacing rhythm. Typography scale pass. Color consistency. Focus rings on all interactive elements. Empty states with illustration/icon + CTA. Loading skeletons for item list, history, share dialog. Subtle transitions on item add/remove.

**Addresses:** Spacing consistency (table stakes), text hierarchy (table stakes), color contrast AA compliance (table stakes), empty states (table stakes), skeleton screens beyond project list (differentiator), item add/remove animations (differentiator).

**Avoids pitfalls:** P-V1 (dark mode class strategy — if toggle added, use `document.documentElement.classList.toggle('dark', isDark)`; no `prefers-color-scheme` media queries), P-V2 (shadcn component edits — prefer `app.css` variable overrides; annotate direct file edits), P-V3 (canvas item colors — treat stored hex values as immutable user data; add selection rings as additive layers), P-V4 (Konva text doesn't reflow — update hardcoded `fontSize` px values explicitly if base font changes).

**Research flag:** Standard pattern — Tailwind and shadcn-svelte visual polish is well-documented. No further research needed.

### Phase Ordering Rationale

- Phase 1 is a hard prerequisite: Paraglide types must exist before `bun check` passes; Sonner must exist before any component can emit toasts.
- Phases 2 and 3 can overlap (different files: Phase 2 touches `.svelte` templates; Phase 3 touches `.svelte.ts` stores and layout).
- Phase 4 should follow Phase 3 so new toast/dialog elements are available for safe-area inset verification.
- Phase 5 must follow Phases 2-4 to avoid visual work being undone by subsequent string extraction or component structure changes.
- The ordering avoids the most significant pitfall pattern: adding new components (empty states, error boundaries) and forgetting to add their strings to the i18n extraction queue.

### Research Flags

Needs deeper attention during implementation:

- **Phase 3 (upload progress):** `fetch` has no progress API. Evaluate XHR vs. Streams API before writing the task. A spinner is an acceptable fallback if progress granularity proves too costly.
- **Phase 4 (real-device testing):** iOS Safari `dvh` + virtual keyboard and Konva `visibilitychange` behavior require physical device verification. Block time for this; emulator results are unreliable.

Standard patterns — no further research needed:

- **Phase 1 (Paraglide + Sonner setup):** Official documentation is thorough and current.
- **Phase 2 (string extraction):** Mechanical per-component work; process documented in `docs/plans/paraglide-i18n.md`.
- **Phase 5 (visual polish):** Standard Tailwind + shadcn-svelte patterns.

---

## Confidence Assessment

| Area         | Confidence  | Notes                                                                                                                                                                                                   |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH        | All library versions verified against npm registry. Deprecated packages explicitly identified. Installation commands confirmed against official docs.                                                   |
| Features     | HIGH        | Benchmarked against 5 production floorplanner and design apps. Table-stakes features have direct precedent. Anti-features are explicitly motivated.                                                     |
| Architecture | HIGH        | Based on actual codebase analysis (127 files, existing `isMobile` pattern, store structure, hooks chain). No speculative additions.                                                                     |
| Pitfalls     | MEDIUM-HIGH | i18n, mobile, and error pitfalls grounded in codebase-specific evidence. Canvas pointer-cancel / iOS keyboard pitfalls grounded in platform behavior. Visual pitfalls grounded in Tailwind 4 specifics. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Upload progress UX:** Whether to use XHR, Streams API, or a simple spinner is unresolved. The decision affects Phase 3 scope. Confirm before writing Phase 3 tasks.
- **PWA + Paraglide bundle strategy:** Whether Paraglide's Vite plugin produces per-locale JS bundles or a single inline bundle affects service worker precache configuration. Verify during Phase 1 setup with `bun build` + offline test.
- **German translation quality:** Machine-translated DE strings are recognizable to native speakers. The research notes DE should be human-reviewed before shipping. This is a content dependency, not a code dependency — flag for the milestone owner to arrange review.
- **`<svelte:boundary>` async limitations:** Svelte's error boundary does not catch errors in async event handlers, only rendering/effect errors. The canvas uses async ops (image loading, etc.). Any canvas async error path needs explicit try/catch + toast, not reliance on the boundary alone.

---

## Sources

### Primary (HIGH confidence)

- npm registry: `@inlang/paraglide-js` v2.11.0 confirmed; `@inlang/paraglide-sveltekit` deprecation confirmed
- [inlang.com Paraglide SvelteKit docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/sveltekit) — setup pattern, strategy options
- [svelte.dev CLI paraglide docs](https://svelte.dev/docs/cli/paraglide) — official SvelteKit recommendation
- [konvajs.org mobile events](https://konvajs.org/docs/events/Mobile_Events.html) — native touch API confirmed
- [konvajs.org multi-touch scale](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html) — pinch-zoom pattern
- [shadcn-svelte.com Sonner](https://www.shadcn-svelte.com/docs/components/sonner) — Svelte 5 + Tailwind 4 compatibility confirmed
- [shadcn-svelte.com Skeleton](https://www.shadcn-svelte.com/docs/components/skeleton) — component verified
- [svelte.dev $app/state](https://svelte.dev/docs/kit/$app-state) — `navigating` rune confirmed for SvelteKit 2.12+
- [svelte.dev svelte:boundary](https://svelte.dev/docs/svelte/svelte-boundary) — async limitation confirmed
- [svelte.dev errors](https://svelte.dev/docs/kit/errors) — three-layer error hierarchy confirmed
- [tailwindcss.com v4.0](https://tailwindcss.com/blog/tailwindcss-v4) — `@theme` CSS-first config confirmed
- [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) — iOS 16+ `none` support confirmed

### Secondary (MEDIUM confidence)

- [Paraglide 2.0 SvelteKit migration guide (dropanote.de)](https://dropanote.de/en/blog/20250506-paraglide-migration-2-0-sveltekit/) — sequence() ordering, middleware pattern
- [shadcn-svelte Tailwind v4 migration](https://www.shadcn-svelte.com/docs/migration/tailwind-v4) — tw-animate-css compatibility
- Competitive analysis: Figma, Floorplanner.com, IKEA Home Planner, RoomSketcher, HomeByMe — feature benchmarking
- GitHub: `wobsoriano/svelte-sonner` — Svelte 5 runes support in v1.0.5

---

_Research completed: 2026-02-17_
_Ready for roadmap: yes_
