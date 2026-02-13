# Code Review Findings

## Status: IN PROGRESS

## Summary

Full codebase review completed with 93 findings across 4 areas. Phases 1-4 done. Phase 5 (component refactoring) remains as optional larger effort.

| Area | Critical | Important | Minor | Total |
|------|----------|-----------|-------|-------|
| Server-side | 4 | 13 | 11 | 28 |
| Components | 3 | 9 | 12 | 24 |
| Stores/Utils | 3 | 8 | 9 | 20 |
| Config/Architecture | 3 | 7 | 11 | 21 |
| **Total** | **13** | **37** | **43** | **93** |

## Completed

### Phase 1: Bug Fixes
- [x] Fix auth callback swallowing SvelteKit redirects (`callback/+server.ts:85`)

### Phase 2: Dead Code Removal
- [x] Remove unused `gt`, `lt` imports from `session.ts` and `oauth.ts`
- [x] Remove `getSession`, `deleteUserSessions`, `cleanExpiredSessions` from `session.ts`
- [x] Remove `createUser`, `findUserById` from `users.ts`
- [x] Remove `cleanupExpiredOAuthData`, `revokeClientTokens` from `oauth.ts`
- [x] Remove `schema.sql` orphaned file
- [x] Deduplicate `UserProfile` type (re-export from types.ts)
- [x] Remove console.log from thumbnails and MCP routes
- [x] Remove `rectsOverlap`, `MOBILE_SCALE_FACTOR` (already done in commit 8574394)
- [x] Remove dead `roomPolygons` derived state + unused `Rect` import from WallsDoorsLayer

### Phase 2: Investigated & Closed (no action needed)
- `itemToRect` — used by `getOverlappingItems()`, not dead
- `ProjectListDialog` — doesn't exist in codebase
- `RemoteCursor.svelte` — no effect bug found, implementation correct

### Phase 3: Deduplication
- [x] Extract `getInitials` to `$lib/utils/format.ts` (was in 4 components)
- [x] Extract `parseDataUrl` to `$lib/utils/data.ts` (was in sync + project stores)
- [x] Extract `isSafeRedirectPath` to `$lib/server/http.ts`
- [x] Extract `isValidRedirectUriFormat` to `$lib/server/oauth.ts`
- [x] Extract `touchProject` to `$lib/server/projects.ts`
- [x] Extract `resolveDefaultBranch` to `$lib/server/branches.ts`
- [x] Extract `serveFileWithEtag` to `$lib/server/http.ts` (was in 4 image routes)
- [x] Extract `parseItemCreateBody` to `$lib/server/items.ts` (was in 2 REST routes)
- [x] Deduplicate thumbnail path helper (use `getThumbnailPath` from `thumbnails.ts`)
- [x] Extract `sanitizeItemsForShare` to `$lib/server/share-links.ts` (was in 2 share routes)

### Phase 3: Investigated & Closed (no action needed)
- `verifyShareAccess` — no existing function to extract; inline auth checks are contextual per route

### Phase 4: Architecture
- [x] Remove duplicate `@lucide/svelte` package
- [x] Remove unused `adapter-auto` and `postgres` packages
- [x] Fix insecure SESSION_SECRET default (now throws in production if not set)

### Phase 4: Investigated & Closed (no action needed)
- Error handling — already consistent (`throw error()` for errors, `return json()` for success)

## WHERE TO CONTINUE

### Phase 5: Component Refactoring (larger effort, optional)
- [ ] Split `projects/[id]/+page.svelte` (1399 lines)
- [ ] Deduplicate zoom/pan logic between Canvas and MobileCanvas
- [ ] Deduplicate comment creation functions
