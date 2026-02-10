# Plan: Fix Unit Tests + Add Playwright E2E Tests

## Context
142 of 151 unit tests pass. 9 fail due to infrastructure issues (Svelte 5 runes not compiled in test env, `$env` alias broken). No e2e tests exist — Playwright isn't installed. The app is a local-first floor planner that works without auth/database, making it ideal for e2e testing.

---

## Part 1: Fix Failing Unit Tests

### Issue A: `$state` not defined (5 store tests)
**Root cause:** `.svelte.ts` files use Svelte 5 runes (`$state`, `$derived`) but Vitest doesn't run them through the Svelte compiler.

**Fix:** The `sveltekit()` vite plugin should handle `.svelte.ts` files, but vitest may need explicit configuration. Add `deps.optimizer.web.include` or configure the svelte plugin to process `.svelte.ts` in test mode. Most likely fix: ensure vitest uses the vite plugins by not overriding the environment in a way that skips them, or add `server.deps.inline` for svelte files.

**Files:** `vite.config.ts`

### Issue B: `$env/dynamic/private` not found (4 server tests: session, oauth + 2 API route tests)
**Root cause:** The alias in `test.alias` uses `new URL(...).pathname` which may not resolve correctly. The `vi.mock('./env')` in tests should intercept, but vitest resolves the transitive `$env/dynamic/private` import before the mock takes effect.

**Fix:** Add `$env/dynamic/private` and `$env/static/private` to `test.alias` using a relative path string (not URL). Also add any other `$env/*` modules that may be imported.

**Files:** `vite.config.ts`, possibly `src/lib/test-utils/mocks/env.ts`

---

## Part 2: Add Playwright E2E Tests

### Step 1: Install & Configure Playwright
- `bun add -d @playwright/test`
- Install browsers: `bunx playwright install chromium`
- Create `playwright.config.ts` with:
  - baseURL: `http://localhost:5173`
  - webServer config to start `bun dev` automatically
  - Single browser (chromium) for speed
  - Screenshot on failure

### Step 2: Create Test Structure
```
e2e/
  home.spec.ts         # Home page, project list
  project-crud.spec.ts # Create, rename, delete local projects
  canvas.spec.ts       # Canvas interactions (items, drag, grid)
  branches.spec.ts     # Branch create/switch/delete
  comments.spec.ts     # Comment creation and display
  mobile.spec.ts       # Mobile viewport tests
  share.spec.ts        # Share link flow (if DB available)
```

### Step 3: E2E Test Scope (Local-First, No Auth Required)
The app works fully offline with IndexedDB. Tests will focus on:

1. **Home page** — renders, shows empty state or project cards
2. **Create local project** — click new, enter name, project created
3. **Floorplan upload** — upload image, see it on canvas
4. **Add items** — use sidebar to add furniture, verify on canvas
5. **Item editing** — click item, edit name/price/dimensions
6. **Canvas controls** — zoom, pan, grid toggle, snap toggle
7. **Branch management** — create branch, switch, verify items differ
8. **Comments** — open comments panel, add comment, see it listed
9. **Mobile layout** — resize to <768px, verify bottom tabs appear, sidebar hidden
10. **Export/Import** — export project JSON, re-import it

### Step 4: Add npm scripts
- `"test:e2e": "bunx playwright test"`
- `"test:e2e:ui": "bunx playwright test --ui"`

---

## Verification
1. `bun test` — all 151 unit tests pass (0 failures)
2. `bun test:e2e` — all Playwright tests pass
3. `bun check` — no type errors

---

## Notes
- Canvas uses Konva.js (HTML5 Canvas) — most canvas interactions can't be tested via DOM selectors. Tests will focus on UI controls, sidebar, and page-level interactions rather than pixel-precise canvas dragging.
- Auth-dependent flows (cloud sync, sharing with password, settings) are skipped since they require a running PostgreSQL + Infomaniak OAuth.
- Tests require `bun dev` to be running (Playwright webServer config handles this).
