# UX Polish Milestone — Pitfalls

**Research Date:** 2026-02-17
**Scope:** i18n retrofit with Paraglide.js, mobile canvas UX, visual design polish, error handling

---

## 1. i18n Retrofit (Paraglide.js)

---

### P-I1: Strings in `.svelte.ts` stores are not reactive to locale changes

**Description:** Paraglide message functions are compiled to return the string for the locale active at call time. Svelte store files (`project.svelte.ts`, `auth.svelte.ts`, etc.) run outside component scope. Error strings and state labels set once inside `try/catch` or store initialization will not re-evaluate when the user switches locale mid-session.

**Warning signs:**

- Any hardcoded English string inside `src/lib/stores/*.svelte.ts` that surfaces in the UI (e.g. `throw new Error('Failed to load projects')`, branch name `'Main'` in `MAIN_BRANCH_NAME`)
- Strings stored into `$state` variables rather than derived on render

**Prevention:**

- Keep user-visible strings in component templates where Svelte's reactivity re-runs the message function when locale changes
- For strings that must originate in a store (e.g. toast messages), pass a message key token and let the component resolve it, or call the message function at the point of display, not at the point of storage
- `MAIN_BRANCH_NAME = 'Main'` in `src/lib/server/branches.ts` is a database value — do not translate it; translate only the display label in the component that renders the branch name

**Phase:** i18n infrastructure (Phase 1) — identify the pattern before extracting any strings

---

### P-I2: Hardcoded strings inside Konva canvas render functions are invisible to the extractor

**Description:** `FloorplanCanvas.svelte` (1402 lines) uses Konva `Text` nodes rendered via `svelte-konva`. Text content passed to `<Text text="..." />` props is not inside HTML — static analysis and IDE plugins that highlight unharvested strings will miss them. Konva text also does not participate in SSR, so SSR-based locale detection is irrelevant here, but strings must still be translated.

**Warning signs:**

- Any string passed to a Konva `<Text text={...} />` prop, `drawGridScene` label, distance-indicator labels, or context menus drawn on the canvas
- A completed i18n pass where the canvas still shows English-only labels while the sidebar is translated

**Prevention:**

- Audit every `<Text>` and computed string in `FloorplanCanvas.svelte` and `CommentsLayer.svelte` explicitly — do not rely on automated extraction
- Pass translated strings as props into canvas components from the parent Svelte component where the message functions are reactive
- Add a checklist item in the verification step: manually toggle locale and visually inspect the canvas

**Phase:** Group E (Canvas Components) extraction — do not consider this group complete without a visual canvas check

---

### P-I3: `toLocaleDateString()` and `toLocaleString()` calls bypass Paraglide locale

**Description:** The codebase calls `new Date().toLocaleDateString()`, `new Date().toLocaleString()`, and `formatRelativeTime` (duplicated in `ProjectCard.svelte` and `history/+page.svelte`) without a locale argument. These calls use the browser's locale, which is independent of the Paraglide cookie locale. A German-speaking user who has set their browser to English will get English date formats even after switching to German in the app.

**Warning signs:**

- `toLocaleDateString(undefined, ...)` in `ProjectListDialog.svelte:19`, `ProjectCard.svelte:36`, `ImportLocalProjectsModal.svelte:121`
- `toLocaleString()` without a locale arg in `ShareLinkList.svelte:45`, `history/+page.svelte:166`
- Duplicate `formatRelativeTime` implementations in two files (the plan already notes consolidation via Group M)

**Prevention:**

- When consolidating `formatRelativeTime` into `src/lib/utils/relative-time.ts` (Group M), accept a `locale: string` parameter sourced from Paraglide's `getLocale()` at the call site
- Replace all bare `toLocaleDateString()` and `toLocaleString()` calls with explicit locale arguments, e.g. `toLocaleDateString(getLocale(), { ... })`
- Add a grep check in the verification checklist: `grep -r 'toLocaleString\(\|toLocaleDateString(' src/` should return no results without a locale argument

**Phase:** Group M (Relative Time Utility) — must be completed before or alongside Group A/B

---

### P-I4: `aria-label`, `placeholder`, and `title` attributes are missed during extraction

**Description:** Non-visible strings — `aria-label`, `placeholder`, `title`, `alt` — are critical for accessibility and screen readers. They are syntactically different from visible text content and are easy to skip during a file-by-file extraction pass. This codebase already has `aria-label="Select color {presetColor}"` and `placeholder="e.g., Sofa, Bed, Desk"` in `ItemForm.svelte`.

**Warning signs:**

- After an extraction pass, running `grep -r 'aria-label="[A-Z]' src/` still returns results with raw English strings
- Screen reader announces English strings while the visible UI is in German

**Prevention:**

- Include accessibility attributes explicitly in the per-component extraction checklist: for each component, grep `aria-label|placeholder|title=|alt=` before marking it done
- For dynamic `aria-label` values that include variables (e.g. `"Select color {presetColor}"`), use Paraglide's parameter syntax: `m.canvas_select_color({ color: presetColor })`

**Phase:** Each extraction group — add as a mandatory sub-step per component

---

### P-I5: Paraglide middleware ordering conflicts with the existing CSRF/session `handle`

**Description:** `hooks.server.ts` exports a single `handle` function that does CSRF checking, CORS preflight, and session parsing. The Paraglide plan wraps this with `sequence(paraglideHandle, appHandle)`. If the CSRF check fires before Paraglide sets the locale on the request, or if Paraglide modifies the request object in a way that changes content-type or origin headers, the existing manual CSRF logic (`isOriginMismatch`) could break for form submissions.

**Warning signs:**

- After adding Paraglide middleware, form POSTs to `/settings/mcp` or `/oauth/consent` start returning 403
- Locale cookie not being read for POST requests to authenticated endpoints

**Prevention:**

- Place Paraglide middleware first in `sequence()` so it runs before CSRF checks — but verify it only reads and sets locale, it does not mutate method or headers
- After wiring up `sequence()`, manually test a form POST to `/settings/mcp` (authenticated) and a cross-origin OAuth token request to ensure both return expected responses, not 403
- Add an integration test or manual checklist step specifically for form submissions after the middleware change

**Phase:** Phase 1 (Infrastructure Setup, step 1.5) — test immediately after adding the middleware

---

### P-I6: The PWA manifest and service worker precache are locale-unaware

**Description:** `static/manifest.json` contains `name` and `short_name` in English. These are read by the OS when the PWA is installed — they cannot be dynamically translated per-locale. The service worker precaches the compiled JS bundle; if Paraglide produces per-locale bundles or locale-specific assets, the service worker manifest must list them all, otherwise an offline user switching locale gets a cache miss.

**Warning signs:**

- Installed PWA shows English app name regardless of locale setting
- After locale switch, app fails offline because service worker does not have the alternate locale bundle

**Prevention:**

- Accept the constraint: manifest strings stay English (already documented in the Paraglide plan as "static/manifest.json stays English")
- Confirm with Paraglide's Vite plugin whether it produces separate JS bundles per locale or inlines all locales into one bundle — if separate, verify `@vite-pwa/sveltekit` lists them all in the precache manifest automatically
- Add a `bun build` + offline test to the verification checklist: switch locale, kill network, reload — all strings should resolve

**Phase:** Phase 4 (Service Worker/PWA verification) — do not skip the offline + locale combination test

---

### P-I7: Over-granular message keys cause maintenance burden with no benefit

**Description:** With ~127 files and potentially 500+ strings, choosing keys that are too specific (e.g. `item_form_name_label_in_edit_mode_authenticated`) creates a key explosion. Many near-identical strings ("Cancel", "Save", "Delete") get separate keys per-context and diverge in German translations inconsistently.

**Warning signs:**

- More than one key for the same English string "Cancel" appearing in different components
- Message file growing to 400+ keys where 30% are duplicates of common_cancel/common_save

**Prevention:**

- Follow the plan's `common_` prefix strictly: any string that appears verbatim in more than one component must use a `common_` key
- Before extraction, do a pass to identify strings that will appear in 3+ places — mark them `common_` upfront
- Resist per-component key namespacing for truly common labels

**Phase:** Phase 2 (Message Key Convention) — establish deduplication rule before any extraction begins

---

## 2. Mobile Canvas UX

---

### P-M1: Pointer event and pinch-zoom state desynchronizes when phone screen turns off mid-gesture

**Description:** `FloorplanCanvas.svelte` and `ScaleCalibration.svelte` maintain gesture state in a plain `Map<number, {x, y}>` (non-reactive, intentionally). If the phone screen locks mid-pinch (e.g., auto-lock during a long calibration), `pointercancel` fires and removes the pointers, but the `isPinching` flag and accumulated zoom state can be left in an intermediate value. On resume, touch events start fresh but the stored canvas transform may be wrong.

**Warning signs:**

- Canvas pan/zoom position jumps after phone screen lock during interaction
- `isPinching` remains `true` after resuming from lock screen, blocking single-finger pan

**Prevention:**

- Handle `visibilitychange` (`document.visibilityState === 'hidden'`) by resetting the `pointers` Map and `isPinching` flag — the same cleanup done in `handlePointerUp` for `pointers.size === 0`
- `pointercancel` already calls `handlePointerUp` — verify this fires reliably on mobile browsers during screen lock by testing on iOS Safari and Android Chrome explicitly
- Add the reset to the `onDestroy` cleanup as well

**Phase:** Mobile UX improvements — test on real device, not emulator

---

### P-M2: Long-press item selection conflicts with the browser's native context menu on Android

**Description:** `FloorplanCanvas.svelte` implements a long-press timer to select items on mobile (lines 522–540). Android Chrome's native long-press triggers a context menu (copy, share, select text) at the same timing. `touch-action: none` on the canvas container suppresses pan/scroll but does not reliably suppress the browser context menu triggered by a long press on Android.

**Warning signs:**

- Android Chrome shows "Copy image" or "Open link" context menu overlay during long-press item selection
- Long-press works on iOS but fails on Android

**Prevention:**

- Add `oncontextmenu={(e) => e.preventDefault()}` to the canvas container element
- Test long-press on Android Chrome (both real device and Chrome DevTools mobile emulation with touch simulation)
- Consider replacing the long-press pattern with a visible tap-to-select → reveal-action-bar pattern, which is less fragile than timing-based gestures

**Phase:** Mobile UX improvements

---

### P-M3: Bottom sheet drag handle and keyboard interactions are incompatible with canvas scroll

**Description:** `ItemBottomSheet.svelte` renders over the canvas on mobile. If the sheet is partially open and the user tries to scroll its content, the touch events may be captured by the canvas's `touch-action: none` container underneath. Conversely, if the sheet captures all touches, the canvas cannot be panned behind it.

**Warning signs:**

- Sheet content does not scroll (list of item images, long descriptions) when the sheet is partially expanded
- Canvas pans accidentally when user tries to scroll inside the bottom sheet

**Prevention:**

- Ensure the sheet portal renders outside the canvas container in the DOM — check that `z-index` layering places the sheet's touch target above the canvas
- Add `touch-action: pan-y` to the sheet's scrollable content container, explicitly allowing vertical scroll within it
- Test with a long item description or many images that require scrolling inside the sheet

**Phase:** Mobile UX improvements

---

### P-M4: Viewport height assumptions break when the mobile soft keyboard appears

**Description:** The app uses `100dvh` for layout height (correct). However, when the user taps an input inside `ItemBottomSheet` or `ItemForm` on mobile, the soft keyboard appears and reduces `dvh`. On iOS, `100dvh` may still include the keyboard height at the time of initial render, causing form fields to be obscured under the keyboard.

**Warning signs:**

- Input fields in the bottom sheet are hidden behind the keyboard on iOS
- Form submit button scrolled out of view and unreachable when keyboard is visible

**Prevention:**

- For the bottom sheet form area, use `overflow-y: auto` with a `max-height` that accounts for the keyboard — do not rely solely on `dvh` for the interior scroll container
- On iOS Safari, test by tapping the price input in `ItemBottomSheet` — verify the focused input scrolls into view above the keyboard
- Consider `scrollIntoView({ behavior: 'smooth' })` on the focused input within the sheet

**Phase:** Mobile UX improvements — iOS Safari real device test required

---

### P-M5: Applying Tailwind responsive variants to canvas-internal Konva elements is impossible

**Description:** Tailwind breakpoint classes (`md:hidden`, `md:flex`) only work on DOM elements. Konva renders to a `<canvas>` element — any responsive layout change for canvas controls, labels, or overlays drawn by Konva must be driven by JavaScript state (`mobileMode`), not CSS classes. This is already partially handled, but new canvas UI added during polish (e.g. overlay hints, onboarding prompts) may accidentally use Tailwind-only patterns.

**Warning signs:**

- A new canvas overlay component attempts to use `class="md:hidden"` on a Konva `<Text>` or `<Rect>` — these classes have no effect
- Canvas labels remain visible at desktop sizes when they should only show on mobile

**Prevention:**

- Pass `mobileMode` as a prop to every new canvas sub-component (it already exists in `FloorplanCanvas.svelte`)
- When adding new canvas-drawn UI, use a `{#if mobileMode}` / `{#if !mobileMode}` guard on the Konva element, not a CSS class
- Document this constraint in a comment near the canvas component's `mobileMode` prop

**Phase:** Any canvas-touching work during UX polish

---

## 3. Visual Design Polish

---

### P-V1: Tailwind CSS 4 `@custom-variant dark` requires class strategy, not media query — dark mode toggle is fragile

**Description:** `app.css` defines `@custom-variant dark (&:is(.dark *))` — meaning dark mode requires a `.dark` class on an ancestor element, not the system `prefers-color-scheme` media query. If a dark mode toggle is added as part of design polish, it must set this class on `<html>` or `<body>`, not set a CSS custom property or toggle a `data-theme` attribute. The wrong implementation silently fails — colors revert to light mode with no error.

**Warning signs:**

- Dark mode toggle changes a custom attribute or `data-theme` but shadcn components stay in light mode
- `prefers-color-scheme: dark` media query used in new CSS instead of `.dark` class variant

**Prevention:**

- If dark mode toggle is added, persist the preference to `localStorage` and set `document.documentElement.classList.toggle('dark', isDark)` on mount and on toggle
- Do not add `@media (prefers-color-scheme: dark)` blocks — they conflict with the class-based strategy already in place
- Check that any new custom CSS variables added for canvas colors (`--color-canvas-bg`, `--color-canvas-grid`) have `.dark` class variants if they need to change in dark mode

**Phase:** Visual design polish — before adding any dark mode toggle

---

### P-V2: Polishing shadcn-svelte components by editing `src/lib/components/ui/` directly is lost on future upgrades

**Description:** `src/lib/components/ui/` contains shadcn-svelte component source files (button, dialog, sheet, etc.) that are installed via `bunx shadcn-svelte@latest add`. Running `add` again for a component overwrites local modifications. Visual polish that involves changing default variant styles in these files will be silently lost.

**Warning signs:**

- A visual tweak lands in `button.svelte` inside `src/lib/components/ui/`
- Someone later runs `bunx shadcn-svelte@latest add button` to get a fix and the visual tweak disappears

**Prevention:**

- Design polish changes to shadcn components should use Tailwind CSS variable overrides in `app.css` (e.g. adjusting `--primary`, `--radius`, `--border`), not edits to the component files themselves
- For structural changes unavoidable in the component file, add a comment: `// CUSTOM: <reason> — do not overwrite without reapplying`
- Prefer creating wrapper components in `src/lib/components/` that apply additional classes via `class` prop merging rather than modifying the shadcn source

**Phase:** Visual design polish — establish rule before first polish commit

---

### P-V3: Color changes to canvas items conflict with user-set colors stored in the database

**Description:** Canvas items have user-configurable colors stored as hex strings in the database (`items.color` column). Polishing the visual design may introduce a new color palette or default colors. But items already saved by users will retain their old hex values. If the polish work changes how colors are applied to Konva shapes (e.g. adding opacity layers, stroke effects), old stored colors may look wrong against the new design.

**Warning signs:**

- Existing items look visually broken after a canvas rendering change that assumes colors follow a new palette convention
- Item colors chosen by users no longer have sufficient contrast against a redesigned canvas background

**Prevention:**

- Canvas background color (`--color-canvas-bg: #1e293b`) is a CSS variable — changing it requires verifying contrast against all stored user item colors, not just the defaults
- Treat stored item colors as immutable user data — add rendering changes as additive layers (e.g. a selection ring, drop shadow) rather than replacing how the base color is applied
- Test with the full range of preset colors in `ItemForm.svelte` (the `presetColor` list) after any canvas rendering changes

**Phase:** Visual design polish — canvas section

---

### P-V4: Typography changes break the canvas label layout — Konva text does not reflow

**Description:** Konva `<Text>` elements have fixed `fontSize`, `width`, and `height` set in pixels. If visual polish involves changing the base font size, font family, or rem-to-px assumptions used elsewhere in the UI, the Konva text labels (item name overlays, distance indicators, scale calibration labels) do not adapt — they use hardcoded pixel values and will overflow or truncate.

**Warning signs:**

- Item name text overflows the item rectangle bounding box after a font change
- Distance indicator numbers are clipped or misaligned

**Prevention:**

- Canvas text sizes are set independently of CSS — if the base font changes, update canvas text sizes explicitly in `FloorplanCanvas.svelte`
- Keep a list of all `fontSize` occurrences in canvas files; audit after any typography polish
- Do not use CSS `rem` values inside Konva `<Text>` props — always use absolute `px`

**Phase:** Visual design polish — typography section

---

### P-V5: Loading skeleton does not cover all async states — optimistic updates hide real errors

**Description:** `+page.svelte` has a loading skeleton for initial page load. However, the project store uses optimistic updates for item changes (updates local state immediately, then calls the API). If the API fails, the store logs `console.error` but there is currently no toast, error state, or visual rollback mechanism for the user. Design polish that adds loading/error states only to the initial load skeleton misses the ongoing operation failures.

**Warning signs:**

- An item drag completes visually but the API returns 403 (viewer trying to edit) — no error shown to user
- Store has `console.error('Failed to rename branch:', error)` but no UI-visible error state

**Prevention:**

- Before adding loading state polish, audit every `catch` block in `project.svelte.ts` — any that only `console.error` without updating a user-visible error state are candidates for a toast or inline error
- Design a single error notification pattern (toast or status bar) and apply it consistently across all async operations, not just initial load
- For optimistic updates that fail, implement a rollback: restore the previous state from a snapshot taken before the optimistic update

**Phase:** Error handling improvements — do this before visual polish so the error states can be styled consistently

---

## 4. Error Handling and Empty States

---

### P-E1: Error strings in `throw new Error(...)` inside stores surface as untranslated English in any UI that catches and displays them

**Description:** `project.svelte.ts` throws errors like `throw new Error('Failed to create branch')`. If a component catches these and displays `error.message` directly in the UI (or via a future toast), the message is hardcoded English regardless of the user's locale.

**Warning signs:**

- A component does `catch (e) { errorMessage = e.message }` and renders `{errorMessage}` directly
- After i18n rollout, error messages in toasts or alert dialogs remain in English while the rest of the UI is in German

**Prevention:**

- Do not surface `Error.message` from store-thrown errors in the UI — use discriminated error types or error code strings instead, and let the component map the code to a translated message
- Pattern: `throw Object.assign(new Error(), { code: 'branch_create_failed' })` — component maps `code` to `m.error_branch_create_failed()`
- Alternatively, remove user-facing error throws from stores entirely — have stores set an error state with a code, not a message string

**Phase:** Error handling improvements — coordinate with i18n extraction (Phase 3)

---

### P-E2: Empty state components for offline/no-project scenarios are missing and will be needed for both English and German simultaneously

**Description:** The project list has no dedicated empty state component for the offline-with-no-local-projects scenario (a user opens the PWA for the first time offline). Adding an empty state during polish requires i18n from day one if it is added after the i18n pass, or requires retrofitting if added before.

**Warning signs:**

- A new empty state component is built with hardcoded English strings, then the i18n pass misses it because it was added after the extraction groups were defined

**Prevention:**

- If empty state components are added as part of the polish milestone, add them to the i18n extraction list (Group B for home page, Group G for project page) immediately — do not treat them as "done" until both EN and DE strings are present
- Create the message keys at the same time as the component, even if DE translation is a placeholder initially

**Phase:** Empty state design — any component added must be added to i18n extraction queue same day

---

### P-E3: The service worker caches API error responses — users see stale errors after fixing server issues

**Description:** The service worker uses `NetworkFirst` for `/api/*` routes with a 5-minute cache and up to 50 entries. If a 500 error response is cached (Workbox's `NetworkFirst` caches successful responses only by default, but a misconfiguration can cause this), or if the app shows a stale error state from a previous failed request that is still in component state, the user may see an error UI after the underlying issue is fixed.

**Warning signs:**

- A server-side fix is deployed but users still see error states without refreshing
- Error UI persists across page navigation because error state is stored at the store level and not cleared on route change

**Prevention:**

- Verify Workbox `NetworkFirst` is configured to only cache 2xx responses (default behavior — confirm in `service-worker.ts`)
- Clear store-level error state on route navigation or on the next successful API call for that resource
- Add a "Retry" action to error states rather than requiring a full page refresh

**Phase:** Error handling improvements

---

_Analysis complete: 2026-02-17_
