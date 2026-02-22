# Features Research: UX Polish Milestone

**Project:** Wohnungs-Plan floorplanner PWA
**Milestone:** UX Polish — i18n (EN/DE), mobile UX, visual design, error/loading states
**Research Date:** 2026-02-17

---

## Research Context

This research answers: what UX polish features do production floorplanner and design apps have, what is table stakes vs. differentiating, for each of the four areas in this milestone?

Sources examined: Figma, IKEA Planning Tools, Floorplanner.com, HomeByMe, AutoDesk Homestyler, RoomSketcher, floor.plan, Sweet Home 3D. Also analyzed the current codebase state (127 Svelte files, completed mobile pass, partial i18n plan exists, Sonner toast plan exists).

---

## 1. Internationalization (i18n)

### Table Stakes — must have or users leave

| Feature | Complexity | Notes |
|---------|-----------|-------|
| All UI strings translated (no raw English in German UI) | Medium | ~127 files — plan already written at `docs/plans/paraglide-i18n.md` |
| Language switcher visible and accessible | Low | In sidebar + settings page is sufficient; not buried |
| Locale persists across sessions | Low | Cookie strategy already chosen; survives refresh |
| Numbers, measurements formatted per locale | Low | Decimal comma in DE (3,5 m vs 3.5 m); affects dimension display |
| Date/time formatted per locale | Low | Relative times ("2 minutes ago" / "vor 2 Minuten"); already has `formatRelativeTime` utility |
| Form validation messages translated | Medium | Currently English only; must match UI language |
| HTML `lang` attribute updated dynamically | Low | `%lang%` placeholder already planned |

**Why these are table stakes:** A German-speaking user who lands in the app, sets DE, then sees "Add Item" is confused. Missing translations erode trust immediately. Mixed-language UI is a dealbreaker for non-English speakers.

### Differentiators — competitive advantage

| Feature | Complexity | Notes |
|---------|-----------|-------|
| RTL layout support | High | Not needed for EN/DE; skip entirely |
| Automatic browser language detection | Low | `preferredLanguage` strategy already in Paraglide config |
| Language switcher shows native language names ("Deutsch" not "German") | Trivial | Correct labeling matters to native speakers |
| Translated PWA manifest `name` / `short_name` | Low | Static manifest can't easily be locale-aware; acceptable to keep EN |
| Translated error messages from the server | Medium | Server returns English errors today; translating these is nice-to-have |
| Pluralization rules | Low | Paraglide supports `{count, plural, ...}` syntax; German has different plural forms |

### Anti-features — deliberately skip

| Feature | Rationale |
|---------|-----------|
| URL-based locale routing (`/de/...`) | Already decided against — cookie strategy; would require route refactor |
| More than 2 languages | Out of scope for this milestone; infrastructure supports adding later |
| Machine-translated content (unreviewed) | DE translations should be reviewed before shipping; MT DE is recognizable |
| Separate translation management platform (Crowdin etc.) | Overkill for 2 languages; flat JSON files in `messages/` sufficient |

### Dependencies

- Paraglide infrastructure (Phase 1 of plan) must complete before any string extraction
- Language switcher (Group C of plan) should be done early — needed to test other translations
- Relative time utility (Group M) consolidation unblocks German time strings
- `bun check` must pass after each group to catch type errors from missing message keys

---

## 2. Mobile UX

### Table Stakes — must have or users leave

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Touch targets ≥ 44px on all interactive elements | Low | Partially done (ItemBottomSheet fixed); audit remaining components |
| No content cut off by mobile browser chrome | Low | `100dvh` already applied on project page; needs verification on all routes |
| Pinch-to-zoom on canvas (not page zoom) | Low | Currently working; browser zoom disabled in PWA manifest |
| Landscape orientation usable | Low | Test canvas + bottom sheet in landscape; header shouldn't overflow |
| Keyboard does not obscure active input | Medium | On iOS, virtual keyboard pushes layout; needs `env(keyboard-inset-height)` or `resize` listener |
| Empty states have clear CTAs, not just "No items" | Low | Motivating user to add first item from mobile is essential |
| No horizontal scroll on fixed-width layouts | Low | Check AppSidebar and MobileNav at various widths |
| Tap feedback on interactive elements | Low | `active:` Tailwind classes; canvas items need visual tap response |

### Differentiators

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Haptic feedback on item tap/select | Low | `navigator.vibrate(10)` on canvas item select on mobile |
| Swipe gesture to close bottom sheet | Low | Already planned via shadcn Sheet; verify swipe-down works |
| Pull-to-refresh on project list | Medium | Expected on mobile web; matches native app conventions |
| Contextual mobile toolbar that changes with selection | High | Figma/Fresco pattern — skip for this milestone; existing bottom sheet covers this |
| Long-press on canvas item for context menu | Medium | Mobile equivalent of right-click; desirable but not critical given bottom sheet |
| Photo capture for item images (camera button) | Low | `<input type="file" accept="image/*" capture="environment">` — zero extra code; high user value |
| Offline mode indicator | Low | "You are offline" banner when navigator.onLine is false; high trust signal |

### Anti-features — deliberately skip

| Feature | Rationale |
|---------|-----------|
| Item placement/drag on mobile | Already decided: view + edit only, placement is desktop-only |
| Native app features (push notifications, background sync) | PWA is the target; these require native app |
| Custom gesture recognizer | shadcn Sheet handles swipe natively; don't reinvent |
| Side-by-side panel layout on tablet | No tablet-specific breakpoint; md: breakpoint covers this adequately |

### Dependencies

- Mobile UX improvements depend on nothing upstream
- Photo capture for item images depends on the image upload endpoint already existing (it does)
- Offline indicator depends on the sync store already tracking network state (partially exists via `sync.svelte.ts`)

---

## 3. Visual Design Polish

### Table Stakes — must have or users leave

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Consistent spacing rhythm (4px/8px grid) | Low | Audit for places where spacing deviates; mostly Tailwind classes |
| Consistent text hierarchy (one primary font size per level) | Low | Check project page headers, card titles, sidebar labels |
| Loading skeletons instead of blank flashes | Medium | Project list loads — blank flash currently; skeleton cards match ProjectCard dimensions |
| Empty states with illustration or icon + explanation text | Low | Currently shows icon + text in some places; audit all empty states |
| Focus rings visible on all interactive elements | Low | Accessibility + UX; shadcn components include focus rings; verify canvas controls |
| Color contrast AA compliance on text | Low | Tailwind defaults meet AA; check muted foreground text on backgrounds |
| Saving/sync indicator | Low | Sonner toast plan + "Saved" inline indicator already specced in `docs/plans/2026-02-02-toast-and-saving-indicator.md` |
| Error messages actionable (not just "Error occurred") | Low | Errors should say what happened and what to do |

### Differentiators

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Skeleton screens for all data-fetching components | Medium | Beyond project list — item list, history, share dialog members |
| Subtle animations on item add/remove (slide in, fade out) | Medium | Svelte `transition:` directives; improves perceived quality |
| Canvas item selection glow/ring that matches brand color | Low | Currently generic; custom selection ring improves identity |
| Project card thumbnail loading shimmer | Low | Thumbnails are async; blank gray until loaded; shimmer matches card dimensions |
| Dark mode | High | Tailwind + shadcn-svelte have dark mode support; significant audit required; skip for this milestone |
| Print/export visual polish | Medium | Not in scope |
| Brand colors / design token overhaul | High | Would break existing design; skip unless targeted improvements are safe |

### Anti-features — deliberately skip

| Feature | Rationale |
|---------|-----------|
| Dark mode | Major audit; out of scope for polish milestone |
| Custom illustration/icon set | Lucide is already used consistently; replacement is a branding decision, not polish |
| Fully redesigned layout | This is polish, not redesign; no structural changes |
| Canvas visual style changes (item colors, grid appearance) | Canvas rendering is a separate concern with Konva; out of scope |

### Dependencies

- Skeleton screens depend on shadcn Skeleton component (add via `bunx shadcn-svelte@latest add skeleton`)
- Saving indicator (Sonner) plan already exists and can be implemented independently
- Empty states can be done component-by-component without dependencies
- Animations should be done last, after layout is stable

---

## 4. Error Handling & Loading States

### Table Stakes — must have or users leave

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Network error shows user-visible message (not silent failure) | Low | Currently many `void fetch()` calls fail silently; Sonner toast plan covers this |
| Form submission errors displayed inline | Low | ItemForm catches errors; verify all forms have visible error output |
| Project load failure shows retry CTA | Low | Home page has error state; project page may not |
| Optimistic updates with rollback on failure | Medium | Project store does optimistic updates; verify rollback on 4xx/5xx |
| Loading state during authentication check | Low | AppSidebar shows "Loading..." for auth; verify no flash of unauthenticated content |
| Upload progress indicator for floorplan/images | Low | Large PDF uploads (up to 10MB) have no progress today; at minimum a spinner |
| Confirmation dialogs for destructive actions | Low | Delete project/item uses native `confirm()` in some places; shadcn Dialog is already available |
| 401 handling — redirect to login, not a blank screen | Low | Auth store has login(), but 401 from API mid-session should show meaningful message |

### Differentiators

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Retry button on transient errors | Low | After showing error toast, offer one-click retry for save operations |
| Undo support for destructive item operations | High | Major feature; skip for this milestone |
| Error boundary for canvas crashes | Medium | Konva errors can take down the whole canvas; wrap in try-catch + fallback UI |
| Inline sync status per-item (saved/unsaved indicator) | Medium | Google Docs style per-document indicator; the planned "Saving..." header indicator covers this adequately |
| Conflict resolution UI for real-time collaboration | High | Two users edit same item simultaneously; currently last-write-wins; skip for this milestone |
| Offline queue visibility | Medium | Show pending changes count badge; already has sync store infrastructure |

### Anti-features — deliberately skip

| Feature | Rationale |
|---------|-----------|
| Undo/redo system | Major architectural change; item change history exists but undo is a separate feature |
| Conflict resolution UI | Requires real-time lock protocol changes; out of scope |
| Crash reporting / Sentry integration | Infrastructure decision; not a UI polish item |
| Custom error pages (`/500`, `/404`) | SvelteKit `+error.svelte` handles this; low-priority for this milestone |
| Verbose error codes for debugging | Developer-facing; users don't need error codes |

### Dependencies

- Sonner toast must be installed before any error toast work (covers i18n, mobile, visual, error sections — install once, use everywhere)
- Saving indicator depends on Sonner and the sync tracking store
- Optimistic rollback audit depends on understanding current project store behavior (already documented in ARCHITECTURE.md)
- Upload progress requires either XHR (not fetch) or Streams API — assess before committing

---

## Cross-Cutting: What Binds These Together

The four areas are not independent. Installation order matters:

1. **Sonner first** — error toasts are used in i18n (translated error messages), mobile UX (offline banner), visual polish (saving indicator), and error handling. One install, used everywhere.
2. **Paraglide infrastructure before string extraction** — can't extract strings before the build plugin is wired up.
3. **Language switcher early** — needed to test translations. Without it, you can't verify German strings appear correctly.
4. **Mobile touch audit alongside visual polish** — both involve inspecting the same components; batch reviews save time.
5. **Skeleton screens after layout is stable** — skeletons must match final layout dimensions; don't build them before the layout they represent is finalized.

---

## Priority Stack Rank (for requirements definition)

Rank by: user-visible impact × implementation effort ratio.

| Rank | Feature | Area | Effort |
|------|---------|------|--------|
| 1 | Paraglide infrastructure + first strings (nav, home page) | i18n | Medium |
| 2 | Error toasts (Sonner) for all silent failures | Error/Loading | Low |
| 3 | Language switcher component | i18n | Low |
| 4 | Saving indicator ("Saving..." / "Saved") | Visual/Error | Low |
| 5 | Touch target audit + fixes across all components | Mobile | Low |
| 6 | Upload progress spinner | Error/Loading | Low |
| 7 | Complete string extraction (all 14 groups) | i18n | Medium |
| 8 | Skeleton screens for project list | Visual | Low |
| 9 | Empty states polish (all screens) | Visual | Low |
| 10 | German translations complete and reviewed | i18n | Medium |
| 11 | Virtual keyboard / safe-area audit on iOS | Mobile | Medium |
| 12 | Photo capture button for item images | Mobile | Trivial |
| 13 | Offline indicator banner | Mobile/Error | Low |
| 14 | Confirmation dialogs (shadcn Dialog not native confirm()) | Error | Low |
| 15 | Canvas error boundary | Error | Medium |

---

## What Production Floorplanners Actually Do (Benchmarking Summary)

**Figma (design app, not floorplanner):**
- Full i18n with RTL support; 30+ languages
- Skeleton loaders throughout; no blank flashes
- Every error has a toast; every destructive action has a confirmation dialog
- Mobile: view-only, no editing — same pattern as this app

**Floorplanner.com:**
- EN/DE/FR/NL support
- Cookie-based locale (no URL prefix) — same approach as this app
- Heavy use of spinner overlays for async actions
- Empty state for no-rooms has illustration + "Add a room" CTA
- Mobile: limited editing, view-first

**IKEA Home Planner (web app):**
- Locale from IKEA account, no in-app switcher
- Very aggressive loading states — every button shows spinner on click
- No offline support

**RoomSketcher:**
- 2-language EN/DE version exists — DE strings reviewed, not machine-translated
- Error handling: full error message with contact support link; nothing hidden
- Mobile: Pan/zoom only on canvas, same as this app

**Common patterns across all production apps:**
1. No silent failures — every API error surfaces to the user
2. Empty states are illustrative, not just text
3. Saving state is always visible when data is being written
4. Touch targets ≥ 44px is baseline, not premium
5. Language defaults from browser, overridden by explicit user choice

---

*Research by: gsd-project-researcher | Date: 2026-02-17*
