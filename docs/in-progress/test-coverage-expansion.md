# Test Coverage Expansion

## Status: IN PROGRESS

## What Was Done

### Files Created (Batch 1 — Pure Utility Functions)
- `src/lib/utils/currency.test.ts` — 12 tests, all passing
- `src/lib/utils/exchange.test.ts` — 6 tests, all passing (fixed floating point with `toBeCloseTo`)
- `src/lib/utils/export.test.ts` — 12 tests, all passing
- `src/lib/server/http.test.ts` — 8 tests, all passing

### Files Modified (Batch 1)
- `src/lib/utils/geometry.test.ts` — expanded with ~15 new tests for `getLShapePoints`, `getRectPoints`, `getItemShapePoints`, `getRotatedBoundingBox`, `getMinEdgeDistance`, `rectsOverlap`, `intersectsWall`, `blocksDoor`, `blocksWindow`, `hasArchitecturalCollision`. All passing.

### Files Created (Batch 2 — Server-Side Pure Functions)
- `src/lib/server/oauth.test.ts` — 13 tests for `generateToken`, `hashToken`/`verifyToken`, `verifyPKCE`, `isValidCodeVerifier`, `isValidCodeChallengeS256`. All passing.
- `src/lib/server/session.test.ts` — 12 tests for `parseSessionCookie`, `createSessionCookie`, `clearSessionCookie`, `generateSessionId`. All passing.
- `src/lib/server/rate-limit.test.ts` — 6 tests with fake timers. All passing.

### Files Created (Batch 3 — Svelte Stores)
- `src/lib/stores/sidebar.svelte.test.ts` — 5 tests
- `src/lib/stores/comments.svelte.test.ts` — ~30 tests
- `src/lib/stores/sync.svelte.test.ts` — 7 tests

**Problem**: All `.svelte.test.ts` store tests fail with `ReferenceError: $state is not defined`. This is a **pre-existing issue** — even the existing `auth.svelte.test.ts` and `project.svelte.test.ts` tests fail with the same error. The `sveltekit()` Vite plugin is not transforming `.svelte.ts` files in test mode, so `$state` runes are not compiled.

### Files Created (Batch 4 — API Route Tests)
- `src/lib/test-utils/request-event.ts` — mock `RequestEvent` factory
- `src/routes/api/auth/me/server.test.ts` — 3 tests
- `src/routes/api/projects/server.test.ts` — 5 tests

**Problem**: API route tests fail because they import modules that transitively import `.svelte.ts` stores or `$env/dynamic/private`, hitting the same `$state` / module resolution issues.

## Test Run Summary (last run)
- **139 pass, 12 fail, 9 errors** across 19 files
- All Batch 1 + Batch 2 tests pass cleanly
- Batch 3 + Batch 4 fail due to Svelte runes compilation in test environment

---

## WHERE TO CONTINUE

### Immediate next step: Fix Svelte runes in Vitest

The `$state` rune must be compiled away by the Svelte compiler before tests run. Options:

1. **Add `@sveltejs/vite-plugin-svelte` explicitly to vitest config** with `compilerOptions: { runes: true }` — the `sveltekit()` plugin may not be enabling rune compilation for `.svelte.ts` in test mode.
2. **Check if a newer version of `@sveltejs/kit` / `@sveltejs/vite-plugin-svelte` fixes this** — Svelte 5 rune support in vitest has had bugs.
3. **Alternatively, wrap store state in non-rune patterns for testability** — last resort.

Investigation was in progress: was about to check `svelte.config.js` and the Vite plugin's test-mode behavior when interrupted.

### After fixing runes
- Re-run `bun test` — all Batch 3 store tests should pass
- Fix any remaining Batch 4 API route test issues (likely `$env/dynamic/private` resolution chain)
- Run `bun test --coverage` to see final coverage numbers
- Run `bun check` to ensure no type errors

### Not started (from original plan)
- All tests are written and exist on disk — nothing new to write
- Just need the test environment fix
