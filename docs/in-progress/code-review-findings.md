# Code Review Findings

## Status: IN PROGRESS

## Summary

Full codebase review completed with 93 findings across 4 areas. Phases 1-4 mostly done.

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

### Phase 3: Deduplication
- [x] Extract `getInitials` to `$lib/utils/format.ts` (was in 4 components)
- [x] Extract `parseDataUrl` to `$lib/utils/data.ts` (was in sync + project stores)
- [x] Extract `isSafeRedirectPath` to `$lib/server/http.ts`
- [x] Extract `isValidRedirectUriFormat` to `$lib/server/oauth.ts`
- [x] Extract `touchProject` to `$lib/server/projects.ts`
- [x] Extract `resolveDefaultBranch` to `$lib/server/branches.ts`

### Phase 4: Architecture
- [x] Remove duplicate `@lucide/svelte` package
- [x] Remove unused `adapter-auto` and `postgres` packages

## WHERE TO CONTINUE

### Remaining Phase 2: Dead Code
- [ ] Remove dead exports: `rectsOverlap`, `itemToRect` from geometry.ts
- [ ] Remove `MOBILE_SCALE_FACTOR` (always 1)
- [ ] Remove `ProjectListDialog` if confirmed unused
- [ ] Remove dead `roomPolygons`, unused `Rect` import
- [ ] Fix `RemoteCursor.svelte` effect bug

### Remaining Phase 3: Deduplication
- [ ] Extract `verifyShareAccess` to `$lib/server/share-links.ts`
- [ ] Extract `serveFileWithEtag` to `$lib/server/http.ts`
- [ ] Extract `parseItemCreateBody` helper
- [ ] Deduplicate thumbnail path helpers (use from thumbnails.ts)
- [ ] Deduplicate item sanitization in share routes

### Remaining Phase 4: Architecture
- [ ] Fix insecure SESSION_SECRET default
- [ ] Standardize error handling (throw error() vs return json)

### Phase 5: Component Refactoring (larger effort)
- [ ] Split `projects/[id]/+page.svelte` (1399 lines)
- [ ] Deduplicate zoom/pan logic between Canvas and MobileCanvas
- [ ] Deduplicate comment creation functions
