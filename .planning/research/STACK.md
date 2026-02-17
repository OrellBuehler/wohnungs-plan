# Technology Stack: UX Polish Milestone

**Project:** Wohnungs-Plan floorplanner PWA
**Milestone:** UX Polish — i18n (EN/DE), mobile UX, visual design, error/loading states
**Researched:** 2026-02-17
**Overall confidence:** MEDIUM-HIGH (most claims verified against npm and official docs)

---

## Existing Stack (do not re-research)

SvelteKit 2 + Svelte 5 (runes), Konva 10 + svelte-konva, Drizzle ORM + PostgreSQL,
shadcn-svelte (bits-ui 2), Tailwind CSS 4, @vite-pwa/sveltekit, Bun runtime.
These are not in scope. Only new additions for this milestone are documented below.

---

## Recommended Stack (What to Add)

| Library | Version | Install Command | Purpose |
|---------|---------|-----------------|---------|
| `@inlang/paraglide-js` | `^2.11.0` | `bun add @inlang/paraglide-js` | Compiler-based i18n, type-safe messages |
| `svelte-sonner` (via shadcn-svelte) | `^1.0.5` | `bunx shadcn-svelte@latest add sonner` | Toast notifications (wraps svelte-sonner) |
| shadcn-svelte `skeleton` | latest | `bunx shadcn-svelte@latest add skeleton` | Loading skeleton component |
| No new gesture library | — | — | Konva handles touch natively; see Mobile section |

Total new runtime dependencies: **1** (`@inlang/paraglide-js`).
shadcn-svelte components copy source into `$lib/components/ui/` — no new runtime dependency.

---

## i18n Stack

### Package

**Use `@inlang/paraglide-js` v2.11.0** (latest as of 2026-02-17), not `@inlang/paraglide-sveltekit`.

The old SvelteKit adapter (`@inlang/paraglide-sveltekit`) is **deprecated** at v0.16.1 and no longer
maintained. Paraglide v2 ships a framework-agnostic Vite plugin that covers everything the old adapter
did, and more. Do not install both.

**Confidence: HIGH** — confirmed via npm registry and multiple migration guides.

### Why Paraglide over alternatives

- **Tree-shaking by default**: Compiler emits only the message keys actually used. Competing runtime
  libraries (i18next, typesafe-i18n) include all messages in the bundle.
- **Type safety**: Every message key and parameter is typed. `m.hello_world()` errors at compile time
  if the key doesn't exist or is called with wrong args.
- **Official SvelteKit recommendation**: Listed in the Svelte CLI docs (`sv add paraglide`).
- **Bundle size**: Up to 70% smaller i18n bundles than runtime-based libraries (per inlang benchmarks).

### Setup pattern

```typescript
// vite.config.ts
import { paraglideVitePlugin } from '@inlang/paraglide-js'

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
    }),
    sveltekit(),
  ]
})
```

```typescript
// hooks.server.ts  — add to existing handle chain
import { paraglideMiddleware } from '$lib/paraglide/server'

const paraglideHandle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
    event.request = localizedRequest
    return resolve(event, {
      transformPageChunk: ({ html }) => html.replace('%lang%', locale)
    })
  })

export const handle: Handle = sequence(existingHandle, paraglideHandle)
```

### Message format

Messages live in `messages/{locale}.json` (ICU-compatible format):

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "add_item": "Add Item",
  "items_count": "{count, plural, one {# item} other {# items}}"
}
```

### Strategy for this project

Use `['cookie', 'preferredLanguage', 'baseLocale']` — matches FEATURES.md decision:
- Cookie persists explicit user choice across sessions
- `preferredLanguage` falls back to browser `Accept-Language` for first visit
- `baseLocale` (`en`) is the final fallback
- No URL prefixing (`/de/...`) — avoids route refactor, matches existing app architecture

### Routing and language switching

Language switching is done via `setLocale()` from `$lib/paraglide/runtime`:
```typescript
import { setLocale } from '$lib/paraglide/runtime'
setLocale('de')  // writes cookie, triggers reactive update
```

No page reload required. SvelteKit's `invalidateAll()` may be needed if load functions
depend on locale — this is a documented gotcha (see PITFALLS).

### Confidence: HIGH
Sources: npm registry (v2.11.0 confirmed), inlang official docs, SvelteKit CLI docs, migration guide at dropanote.de.

---

## Mobile UX Stack

### Gesture Handling: No New Library Needed

**Decision: Use Konva's native touch event API, not a gesture library.**

Konva handles `touchstart`, `touchmove`, `touchend` natively on stage and shape nodes.
Pinch-zoom is implemented by tracking two-touch point distance delta in `touchmove` —
this is about 20 lines of math, already documented in Konva's official sandbox examples.
Adding svelte-gestures on top of Konva creates event listener conflicts and doubles the
event processing overhead.

**Confidence: HIGH** — Konva official docs confirm native touch events; community examples
confirm DIY pinch-zoom is the standard approach.

### CSS: touch-action

Apply `touch-action: none` on the canvas container div to prevent the browser from
intercepting touch events for page scroll/zoom before Konva sees them:

```svelte
<div class="canvas-container" style="touch-action: none;">
  <Stage ...>
```

On iOS Safari, `user-scalable=no` in the viewport meta is ignored in newer iOS versions
for accessibility reasons — `touch-action: none` on the canvas element is the reliable
alternative that prevents page zoom without blocking canvas gestures.

**Caveat:** Safari only supports `auto` and `manipulation` for `touch-action` on some older
versions. `none` works on iOS 16+ and all modern Android browsers.

### Safe Area Insets

For notch/home-indicator handling, use CSS environment variables — no library needed:

```css
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

The app already uses `100dvh`. Add `env()` values to fixed bottom navbars and the
canvas container. Already supported in all modern browsers.

### Virtual Keyboard (iOS)

iOS Safari does not fire `resize` when the virtual keyboard appears; the visual viewport
shrinks instead. Use `window.visualViewport.addEventListener('resize', ...)` to detect
keyboard appearance and adjust bottom-sheet position:

```typescript
if (browser) {
  window.visualViewport?.addEventListener('resize', () => {
    const offset = window.innerHeight - (window.visualViewport?.height ?? 0)
    // apply offset to floating elements above keyboard
  })
}
```

No library required. This is a ~10 line pattern.

### Haptic Feedback

```typescript
function haptic(duration = 10) {
  if ('vibrate' in navigator) navigator.vibrate(duration)
}
```

Single utility function. No library. Call on canvas item select/tap.

### Photo Capture

```html
<input type="file" accept="image/*" capture="environment" hidden bind:this={cameraInput}>
```

Zero-dependency camera access via `<input>`. Triggers native camera on iOS and Android
when in a PWA context. Already has an upload endpoint.

### Offline Indicator

```svelte
<script>
  import { browser } from '$app/environment'
  let online = $state(browser ? navigator.onLine : true)
  if (browser) {
    window.addEventListener('online', () => (online = true))
    window.addEventListener('offline', () => (online = false))
  }
</script>

{#if !online}
  <div class="offline-banner">You are offline</div>
{/if}
```

No library. Uses Svelte 5 `$state` rune. Network state exists in `sync.svelte.ts` already —
consolidate there.

### Confidence: HIGH for touch-action, safe-area, haptic, offline patterns. MEDIUM for virtual keyboard (iOS behavior varies by version).

---

## Design System Stack

### Tailwind CSS 4 (already installed at ^4.1.18)

No new Tailwind packages needed. Key Tailwind 4 features already available:

**CSS-first configuration** — `app.css` is already the source of truth. Tokens defined
with `@theme` are automatically available as CSS variables at runtime:

```css
/* app.css — extend existing @theme block */
@theme {
  --color-brand-primary: oklch(55% 0.2 230);
  --color-brand-surface: oklch(97% 0.02 230);
}
```

**Dark mode** — If added later: use `@custom-variant dark (&:is(.dark *))` in `app.css`
and toggle the `.dark` class on `<html>`. This milestone explicitly defers dark mode.

**`tw-animate-css`** is already in `package.json` — use for skeleton pulse animations:

```css
/* Tailwind 4-compatible, already installed */
@import "tw-animate-css";
```

**Performance**: Tailwind 4 incremental builds are 100x faster than v3. No action needed —
this benefit is automatic.

### shadcn-svelte (already installed via bits-ui ^2.15.5)

**Add these two components for this milestone:**

```bash
bunx shadcn-svelte@latest add skeleton
bunx shadcn-svelte@latest add sonner
```

Both are listed in the official shadcn-svelte component registry and are Svelte 5 + Tailwind 4
compatible (shadcn-svelte v1.1.0+ migrated to tw-animate-css for Tailwind 4 compatibility).

**Skeleton component** — Copies to `$lib/components/ui/skeleton.svelte`. Uses `animate-pulse`
from tw-animate-css. Matches the app's existing Tailwind token system automatically.

**Sonner component** — Copies to `$lib/components/ui/sonner.svelte`. Wraps `svelte-sonner`
v1.0.5 (Svelte 5 compatible with runes). Add `<Toaster />` once to root layout:

```svelte
<!-- +layout.svelte -->
<script>
  import { Toaster } from '$lib/components/ui/sonner'
</script>

<Toaster position="bottom-right" richColors />
<slot />
```

Then call from anywhere:

```typescript
import { toast } from 'svelte-sonner'
toast.error('Could not save project')
toast.success('Project saved')
toast.promise(savePromise, {
  loading: 'Saving...',
  success: 'Saved',
  error: 'Failed to save'
})
```

**Confidence: HIGH** — Both components verified on shadcn-svelte official docs and confirmed
Svelte 5 + Tailwind 4 compatible.

### Design Token Approach for This Milestone

Do not overhaul the token system. Make targeted additions only:

1. Any brand-color customizations go in the existing `@theme` block in `app.css`
2. shadcn-svelte's CSS variable system (`--primary`, `--muted`, etc.) is already in place
3. Spacing polish uses existing Tailwind utilities — no custom spacing tokens

---

## Error Handling Stack

### SvelteKit Error Hierarchy (no new packages)

SvelteKit has three error handling layers — use all three:

**Layer 1: `+error.svelte`** — catches errors from `load()` functions per-route.
Creates a page-level fallback. Already standard SvelteKit. Add a `+error.svelte`
to the `routes/projects/[id]/` route if missing:

```svelte
<!-- routes/projects/[id]/+error.svelte -->
<script>
  import { page } from '$app/state'
</script>
<h1>Could not load project</h1>
<p>{page.error?.message}</p>
<a href="/">Back to projects</a>
```

**Layer 2: `<svelte:boundary>`** — Svelte 5 native error boundary for runtime rendering
errors. Wraps components that could throw during render (e.g., the canvas component).
Does NOT catch errors in async event handlers — only rendering/effect errors:

```svelte
<svelte:boundary onerror={(e) => toast.error('Canvas error: ' + e.message)}>
  <KonvaCanvas ... />
  {#snippet failed(error, reset)}
    <p>Canvas failed to render.</p>
    <button onclick={reset}>Retry</button>
  {/snippet}
</svelte:boundary>
```

**Layer 3: `handleError` in `hooks.server.ts`** — catches unexpected server errors,
prevents leaking stack traces:

```typescript
export const handleError: HandleServerError = ({ error, event }) => {
  console.error('Unexpected server error:', error)
  return {
    message: 'An unexpected error occurred. Please try again.'
  }
}
```

### Toast Notifications: svelte-sonner via shadcn-svelte Sonner

**Already specified above in Design System Stack.** Install once, use in all four milestone areas.

`toast.promise()` is the most important API for this app — it covers the common
`async () => { setLoading(true); await save(); setLoading(false) }` pattern without
manual state management:

```typescript
toast.promise(projectStore.save(), {
  loading: m.saving(),        // Paraglide translation key
  success: m.saved(),
  error: m.save_failed()
})
```

### Loading States: `$app/state` navigating (no new package)

SvelteKit 2.12+ exposes `navigating` from `$app/state` (Svelte 5 rune-compatible):

```svelte
<script>
  import { navigating } from '$app/state'
</script>

{#if navigating}
  <LoadingBar />
{/if}
```

This replaces `$app/stores` for Svelte 5 projects. Use for route-level loading indicators.

### Skeleton Screens: shadcn-svelte Skeleton

Already specified above. Pattern for project list:

```svelte
{#if loading}
  {#each { length: 3 } as _}
    <Skeleton class="h-40 w-full rounded-xl" />
  {/each}
{:else}
  {#each projects as project}
    <ProjectCard {project} />
  {/each}
{/if}
```

### Confidence: HIGH for all error handling patterns (SvelteKit official docs). MEDIUM for `<svelte:boundary>` — has known limitations with async script errors (see PITFALLS).

---

## What NOT to Use

### Do Not Use: `@inlang/paraglide-sveltekit`

**Deprecated** at v0.16.1, last published over a year ago. Paraglide v2 makes it
obsolete. Installing it alongside `@inlang/paraglide-js` v2 will cause conflicts.

### Do Not Use: `i18next` or `typesafe-i18n`

Runtime message loading means the full translation bundle ships on every page.
Paraglide's compiler eliminates unused messages. For a floorplanner with 127 Svelte files,
the bundle difference is significant. Paraglide is the official SvelteKit recommendation.

### Do Not Use: `svelte-gestures` or `@use-gesture/vanilla`

Konva intercepts touch events at the canvas element level. Adding a separate gesture
library on the same element creates competing pointer event handlers. Konva's own
`touchmove` with two-touch distance math is 20 lines and has no conflict risk.
The svelte-gestures library is also only v1.3.x and hasn't seen significant updates.

### Do Not Use: `$app/stores` for navigation state

`$app/stores` works in Svelte 5 but is deprecated. Use `$app/state` (requires SvelteKit
2.12+, which this project already meets with `@sveltejs/kit ^2.50.1`). `$app/state`
returns Svelte 5 `$state`-based proxies instead of Svelte 4 stores.

### Do Not Use: `zerodevx/svelte-toast`

An older toast library predating Sonner. svelte-sonner (wrapped by shadcn-svelte's Sonner
component) has Svelte 5 runes support, matches the existing design system, is already
referenced in the project's existing plan docs, and has better accessibility.

### Do Not Use: `navigator.language` alone for locale detection

`navigator.language` returns the first browser language regardless of what the user
wants for this app. Paraglide's `preferredLanguage` strategy reads `Accept-Language`
headers server-side (more reliable than client JS access) and is already part of the
recommended strategy array.

### Do Not Use: URL-based locale routing (`/de/projects`)

Already decided against in FEATURES.md. Requires restructuring every route in the app.
Cookie strategy covers the same need without structural changes.

### Do Not Use: Native `confirm()` for destructive action dialogs

`confirm()` is unthemeable, blocks the main thread, and is suppressed in some PWA
contexts. The shadcn-svelte `Dialog` component is already installed — use it.

---

## Installation Summary

```bash
# i18n
bun add @inlang/paraglide-js

# UI components (copies source into $lib/components/ui/)
bunx shadcn-svelte@latest add skeleton
bunx shadcn-svelte@latest add sonner

# No additional packages needed for:
# - Mobile gestures (Konva native)
# - Safe area insets (CSS env())
# - Haptic feedback (Web API)
# - Offline indicator (Web API)
# - Error handling (SvelteKit built-in + svelte:boundary)
# - Loading states ($app/state navigating)
```

After adding Paraglide, initialize the inlang project config:

```bash
bunx @inlang/paraglide-js@latest init
```

This generates `project.inlang/settings.json` and `messages/en.json` scaffold.

---

## Sources

- [@inlang/paraglide-js npm registry](https://www.npmjs.com/package/@inlang/paraglide-js) — version 2.11.0 confirmed
- [@inlang/paraglide-sveltekit npm — deprecated notice](https://www.npmjs.com/package/@inlang/paraglide-sveltekit)
- [Paraglide JS SvelteKit docs (inlang.com)](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/sveltekit)
- [Paraglide 2.0 SvelteKit migration guide](https://dropanote.de/en/blog/20250506-paraglide-migration-2-0-sveltekit/)
- [Svelte CLI paraglide docs](https://svelte.dev/docs/cli/paraglide)
- [Konva mobile touch events](https://konvajs.org/docs/events/Mobile_Events.html)
- [Konva multi-touch pinch zoom](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html)
- [svelte-sonner GitHub (Svelte 5 v1.0.5)](https://github.com/wobsoriano/svelte-sonner)
- [shadcn-svelte Sonner component](https://www.shadcn-svelte.com/docs/components/sonner)
- [shadcn-svelte Skeleton component](https://www.shadcn-svelte.com/docs/components/skeleton)
- [shadcn-svelte Tailwind v4 migration](https://www.shadcn-svelte.com/docs/migration/tailwind-v4)
- [SvelteKit $app/state docs](https://svelte.dev/docs/kit/$app-state)
- [SvelteKit error handling docs](https://svelte.dev/docs/kit/errors)
- [svelte:boundary docs](https://svelte.dev/docs/svelte/svelte-boundary)
- [Tailwind CSS v4.0 release](https://tailwindcss.com/blog/tailwindcss-v4)
- [touch-action MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action)

---

*Research by: gsd-project-researcher | Date: 2026-02-17*
