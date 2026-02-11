# Code Review Findings

## Status: IN PROGRESS

## Summary

Full codebase review completed with 93 findings across 4 areas.

| Area | Critical | Important | Minor | Total |
|------|----------|-----------|-------|-------|
| Server-side | 4 | 13 | 11 | 28 |
| Components | 3 | 9 | 12 | 24 |
| Stores/Utils | 3 | 8 | 9 | 20 |
| Config/Architecture | 3 | 7 | 11 | 21 |
| **Total** | **13** | **37** | **43** | **93** |

## WHERE TO CONTINUE

### Phase 1: Bug Fixes (do first)
- [ ] Fix auth callback swallowing SvelteKit redirects (`callback/+server.ts:85`)
- [ ] Fix `RemoteCursor.svelte` effect bug

### Phase 2: Dead Code Removal
- [ ] Remove unused `gt` import from `session.ts`
- [ ] Remove `getSession`, `deleteUserSessions`, `cleanExpiredSessions`, `generateSessionId` from `session.ts`
- [ ] Remove `createUser`, `findUserById` from `users.ts`
- [ ] Remove `cleanupExpiredOAuthData`, `revokeClientTokens` from `oauth.ts`
- [ ] Remove dead exports: `rectsOverlap`, `itemToRect` from geometry.ts
- [ ] Remove `MOBILE_SCALE_FACTOR` (always 1)
- [ ] Remove `schema.sql` orphaned file
- [ ] Remove `ProjectListDialog` if confirmed unused
- [ ] Remove dead `roomPolygons`, unused `Rect` import

### Phase 3: Deduplication — Shared Utilities
- [ ] Extract `getInitials` to shared util (used in 4+ components)
- [ ] Extract `parseDataUrl` to shared util (in export.ts and thumbnails.ts)
- [ ] Extract `formatRelativeTime` to shared util
- [ ] Extract `isSafeRedirectPath` to `$lib/server/http.ts`
- [ ] Extract `isValidRedirectUriFormat` to `$lib/server/oauth.ts`
- [ ] Extract `touchProject` to `$lib/server/projects.ts`
- [ ] Extract `resolveDefaultBranch` to `$lib/server/branches.ts`
- [ ] Extract `verifyShareAccess` to `$lib/server/share-links.ts`
- [ ] Extract `serveFileWithEtag` to `$lib/server/http.ts`
- [ ] Extract `parseItemCreateBody` helper
- [ ] Deduplicate `UserProfile` type (remove from users.ts, import from types.ts)
- [ ] Deduplicate thumbnail path helpers (use from thumbnails.ts)
- [ ] Deduplicate item sanitization in share routes

### Phase 4: Architecture
- [ ] Remove duplicate lucide-svelte package
- [ ] Remove unused adapter-auto and postgres packages
- [ ] Fix insecure SESSION_SECRET default
- [ ] Standardize error handling (throw error() vs return json)
- [ ] Remove console.log from production code

### Phase 5: Component Refactoring (larger effort)
- [ ] Split `projects/[id]/+page.svelte` (1399 lines)
- [ ] Deduplicate zoom/pan logic between Canvas and MobileCanvas
- [ ] Deduplicate comment creation functions
