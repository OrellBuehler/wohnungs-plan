# Test Coverage Expansion

## Status: COMPLETE

## Summary

Expanded test coverage from initial utility tests to include server-side functions, Svelte stores, and API route tests. Fixed all test environment issues.

## Test Files (19 files, 254 tests)

### Utility Tests
- `src/lib/utils/geometry.test.ts` — 36 tests
- `src/lib/utils/canvas-math.test.ts` — 15 tests
- `src/lib/utils/canvas-performance.test.ts` — 21 tests
- `src/lib/utils/currency.test.ts` — 16 tests
- `src/lib/utils/exchange.test.ts` — 6 tests
- `src/lib/utils/export.test.ts` — 15 tests
- `src/lib/utils/branch-sync.test.ts` — 5 tests

### Server Tests
- `src/lib/server/rate-limit.test.ts` — 6 tests
- `src/lib/server/spatial-queries.test.ts` — 14 tests
- `src/lib/server/http.test.ts` — 8 tests
- `src/lib/server/oauth.test.ts` — 20 tests
- `src/lib/server/session.test.ts` — 17 tests

### Store Tests (Svelte 5 runes)
- `src/lib/stores/auth.svelte.test.ts` — 12 tests
- `src/lib/stores/sidebar.svelte.test.ts` — 6 tests
- `src/lib/stores/sync.svelte.test.ts` — 7 tests
- `src/lib/stores/comments.svelte.test.ts` — 33 tests
- `src/lib/stores/project.svelte.test.ts` — 8 tests

### API Route Tests
- `src/routes/api/auth/me/server.test.ts` — 3 tests
- `src/routes/api/projects/server.test.ts` — 6 tests

## Key Fixes

### 1. Bun runtime unavailable in vitest (`Cannot find package 'bun'`)
- `db.ts` imports from `bun` and `drizzle-orm/bun-sql`, which are unavailable in vitest/node
- **Solution**: Virtual vite plugin (`stubBunForTests`) intercepts `bun` imports and provides a stub
- `server.deps.inline: ['drizzle-orm']` forces drizzle-orm through vite's pipeline so the plugin can intercept

### 2. Svelte `$state` runes work in tests
- Contrary to initial assessment, `$state` compilation works fine in vitest with the `sveltekit()` vite plugin
- The earlier `$state is not defined` errors were cascading failures from the bun import issue

### 3. `$state` proxy and `toBe` vs `toEqual`
- `$state` wraps values in a proxy, so reference equality (`toBe`) fails
- Use `toEqual` for deep equality checks on reactive state

### 4. Schema field rename (`infomaniakId` → `infomaniakSub`)
- Fixed stale test mock to match current schema
