# Codebase Concerns

**Analysis Date:** 2026-02-17

## Tech Debt

**Large Component/Store Files:**

- Issue: Multiple files exceed 1000 lines, making them difficult to maintain and test
- Files:
  - `src/routes/api/mcp/+server.ts` (1617 lines)
  - `src/lib/components/canvas/FloorplanCanvas.svelte` (1402 lines)
  - `src/lib/stores/project.svelte.ts` (1378 lines)
  - `src/routes/projects/[id]/+page.svelte` (1195 lines)
  - `src/lib/components/items/ItemForm.svelte` (412 lines)
- Impact: Harder to find bugs, reduced test coverage, increased merge conflict risk
- Fix approach: Break MCP server into separate tool registration modules, split canvas component into specialized layer components, extract project store logic into separate concern-specific stores, split page component into smaller composable components

**Type Safety Gaps:**

- Issue: 54 instances of unsafe type casts using `as any`, `as unknown as`, which bypass TypeScript checks
- Files:
  - `src/lib/server/floorplan-analyses.ts` (lines 63, 68, 95) - JSON data casts
  - `src/routes/api/projects/server.test.ts` - test mocks
  - `src/routes/api/auth/me/server.test.ts` - test mocks
  - `src/lib/stores/auth.svelte.test.ts` - fetch mocks
  - `src/lib/stores/comments.svelte.test.ts` - fetch mocks
- Impact: Could hide runtime errors, test mocks may not match reality
- Fix approach: Define proper TypeScript interfaces for FloorplanAnalysisData handling, use proper mock typing (vitest/jest), avoid casting JSON deserialization results - use Zod schemas instead

**Unchecked Unsafe File Operations:**

- Issue: Thumbnail and image generation uses FileReader and readAsDataURL without proper error cleanup
- Files: `src/lib/stores/project.svelte.ts` (lines 1010-1013), `src/lib/utils/export.ts`
- Impact: Memory leaks if FileReader errors occur, no error boundary for failed reads
- Fix approach: Wrap FileReader operations in try-catch, add abort cleanup, consider using Blob.stream() or Uint8Array instead of DataURL for large files

## Memory & Resource Leaks

**MCP Session Transport Map:**

- Issue: `sessionTransports` Map in `src/routes/api/mcp/+server.ts` (line 61) maintains references indefinitely
- Files: `src/routes/api/mcp/+server.ts` (lines 1517-1546)
- Problem: Sessions are stored in module-level Map with cleanup only in callbacks. If client disconnects abnormally without triggering callbacks, entries accumulate
- Impact: Server memory grows unbounded with long-running instances; potential DoS via session exhaustion
- Current mitigation: `onsessionclosed` and `onclose` handlers attempt cleanup
- Recommendation: Implement session timeout mechanism (e.g., 30-min idle timeout), periodic Map cleanup, maximum session cap, metrics/monitoring for session count

**WebSocket Cursor Throttle Timeout:**

- Issue: `cursorThrottleTimeout` in `src/lib/stores/collaboration.svelte.ts` (line 41) not always cleared on disconnect
- Files: `src/lib/stores/collaboration.svelte.ts` (lines 70-119)
- Problem: While disconnect clears state, if cleanup happens mid-throttle, timeout persists
- Fix approach: Clear timeout in disconnect() function before clearing state

**Large FileReader Operations:**

- Issue: Converting large files to DataURL allocates full string in memory
- Files: `src/lib/stores/project.svelte.ts`, `src/lib/utils/export.ts`
- Impact: 10MB files with DataURL can cause browser OOM on older devices
- Recommendation: Stream uploads directly to FormData instead of converting to DataURL first, use Blob objects for API calls

## Security Considerations

**Unsafe Type Casting in Floorplan Analysis:**

- Risk: FloorplanAnalysisData deserialized via `as unknown as Record<string, unknown>` without schema validation
- Files: `src/lib/server/floorplan-analyses.ts` (lines 63, 68, 95)
- Current mitigation: Database constraints on column types
- Recommendations:
  - Use Zod schema to validate FloorplanAnalysisData structure at runtime
  - Add schema validation on retrieval before type casting
  - Validate room polygon coordinates are reasonable numbers

**CSRF Protection Bypass:**

- Issue: SvelteKit CSRF disabled globally (`csrf.trustedOrigins: ['*']`) but manual origin check may have gaps
- Files: `src/hooks.server.ts` (lines 11-68)
- Current mitigation: Manual origin check for form submissions (lines 32-47), OAuth/MCP endpoints exempt
- Impact: Cross-origin form submissions rejected, but relies on matching string comparison
- Recommendation:
  - Add logging for rejected CSRF attempts
  - Consider whitelist approach instead of pattern matching
  - Ensure all cookie-based endpoints are protected by origin check

**ParseFloat/ParseInt Without Validation:**

- Issue: Numeric parsing without bounds checking in form inputs
- Files:
  - `src/lib/components/canvas/CanvasControls.svelte` (line 48) - parseInt without radix assurance
  - `src/lib/components/items/ItemForm.svelte` (line 157) - parseFloat on user price input
  - `src/lib/server/env.ts` (line 21) - parseInt on env var
- Impact: Invalid input (NaN, Infinity) could cause UI crashes or incorrect calculations
- Fix approach: Add bounds checks, use Number.isFinite(), validate ranges before using parsed values

**No Input Size Limits on Form Fields:**

- Issue: Item names, URLs, and other string fields accept unbounded input
- Impact: Database bloat, XSS if data displayed without escaping (though Svelte defaults to safe)
- Recommendation: Add max-length constraints on form inputs, validate string lengths server-side

## Performance Bottlenecks

**Canvas Rendering with Many Items:**

- Problem: FloorplanCanvas renders all items every frame; no virtualization
- Files: `src/lib/components/canvas/FloorplanCanvas.svelte` (1402 lines)
- Current mitigation: Grid rendering and distance indicator rendering have performance checks (`shouldRenderGrid`, `shouldShowDistanceIndicators`, etc.)
- Limit: Unknown performance ceiling with 100+ items on screen
- Improvement path:
  - Implement viewport culling - only render items within visible bounds
  - Use Konva layer batching for static vs dynamic items
  - Profile with DevTools on typical projects (50, 100, 500 items)

**Unoptimized Distance Indicator Calculations:**

- Issue: For each item, nearest 2 neighbors calculated every render if distance indicators shown
- Files: `src/lib/utils/geometry.ts`, `src/lib/components/canvas/FloorplanCanvas.svelte`
- Impact: O(n²) distance comparisons for every frame at high zoom
- Improvement path: Memoize neighbor calculations, use spatial indexing (quadtree) for >50 items

**FloorplanAnalysis State Loading in store:**

- Issue: `loadFloorplanAnalysis()` (line 1286+) called on every active branch change without caching
- Files: `src/lib/stores/project.svelte.ts` (lines 1286-1337)
- Impact: Redundant API calls if switching branches back/forth
- Fix approach: Cache analysis per project in store, invalidate on floorplan change only

**Large Page Component Mounting Logic:**

- Problem: `+page.svelte` (1195 lines) with heavy onMount effects and state initialization
- Files: `src/routes/projects/[id]/+page.svelte`
- Impact: Slow page transition, especially on mobile
- Improvement: Extract initialization into separate store modules, lazy-load comment panel

## Fragile Areas

**Project Store State Synchronization:**

- Files: `src/lib/stores/project.svelte.ts`, `src/lib/stores/sync.svelte.ts`
- Why fragile: Complex async state machine managing local project vs cloud project, multiple branches, online/offline transitions
- Symptoms: When switching branches, if API fails and offline, state can become inconsistent (activeBranchId mismatch)
- Safe modification:
  - Always use `setProject()` for batch updates
  - Never modify project state directly outside store functions
  - Add invariant checks: `getProject()?.activeBranchId` should always match actual active branch
- Test coverage gaps:
  - No tests for rapid branch switching with network errors
  - Missing offline→online sync with concurrent edits
  - No tests for when local and cloud diverge

**MCP Tool Authorization Chain:**

- Files: `src/routes/api/mcp/+server.ts` (lines 152-183)
- Why fragile: Each tool registration checks role/permissions independently; easy to forget check in new tool
- Safe modification:
  - Keep `ensureProjectRole()` call at start of EVERY tool implementation
  - Create shared role validation helper (existing but could be more enforced)
  - Add lint rule to catch tools missing authorization checks
- Risk: Adding tools without proper permission checks could expose private data

**Database Migration Auto-Run:**

- Files: `src/lib/server/db.ts` (lines 22-34), `src/hooks.server.ts` (lines 6-8)
- Why fragile: Migrations run on every server startup; if migration fails partially, server won't recover gracefully
- Safe modification:
  - Check migrations table status before auto-running
  - Add migration rollback capability
  - Log migration results to monitoring
  - Never assume migrations can run silently

**Collaboration State with Stale Connections:**

- Files: `src/lib/stores/collaboration.svelte.ts` (lines 70-119)
- Why fragile: WebSocket can appear connected but be stale; user cursors/locks won't update
- Safe modification:
  - Add periodic heartbeat/ping mechanism
  - Clear stale users after timeout (e.g., 30s no activity)
  - Show user connection status indicators
- Test coverage: No tests for connection drop/recovery scenarios

## Scaling Limits

**File Upload Directory Growth:**

- Current structure: Floorplans, item images stored in `/uploads/` subdirectories by project UUID
- Limit: Single filesystem with no sharding - performance degrades with 10,000+ files
- Scaling path:
  - Implement file sharding by hash prefix
  - Move to S3/cloud storage at scale
  - Add cleanup for orphaned files (items deleted but images remain)

**MCP Session Storage:**

- Current: In-memory Map per server instance
- Limit: Multi-instance deployment requires sticky sessions or shared session store
- Scaling path: Move to Redis session store, implement session cleanup jobs

**Database Query Load:**

- Issue: Some queries load full project with all items/branches (`select()` calls)
- Files: Multiple `src/lib/server/*.ts` files use `.select()` without column specification
- Limit: Performance degrades with projects containing 1000+ items
- Scaling path: Add pagination, implement selective column queries, consider denormalization for frequently-accessed aggregates

## Test Coverage Gaps

**Branch Switching with Network Errors:**

- What's not tested: Switching active branch while offline, then going online with diverged state
- Files: `src/lib/stores/project.svelte.ts` (branch switching logic), `src/lib/stores/sync.svelte.ts`
- Risk: Could leave UI in inconsistent state (showing items from different branches)
- Priority: High - user-facing feature

**Collaboration Lock Conflicts:**

- What's not tested: Two users selecting same item, rapid lock/unlock, stale locks after disconnect
- Files: `src/lib/stores/collaboration.svelte.ts`
- Risk: Items appear locked but aren't, or unlock fails silently
- Priority: Medium - affects collaborative editing experience

**Large File Uploads (10MB edge case):**

- What's not tested: Upload exactly at 10MB limit, upload slightly over limit, network abort during upload
- Files: `src/routes/api/projects/[id]/floorplan/+server.ts`, `src/routes/api/projects/[id]/branches/[branchId]/items/[itemId]/images/+server.ts`
- Risk: May accept oversized files or crash during buffer allocation
- Priority: Medium - could cause data corruption

**Canvas Rendering with 100+ Items:**

- What's not tested: Performance profile with many items on screen
- Files: `src/lib/components/canvas/FloorplanCanvas.svelte`
- Risk: Rendering freeze on devices with many items placed
- Priority: Low - affects edge cases

**OAuth Token Expiration Handling:**

- What's not tested: Access token expiring during long session, refresh token rotation
- Files: `src/lib/server/oauth.ts`, `src/routes/api/oauth/token/+server.ts`
- Risk: User stuck with invalid token, no automatic refresh
- Priority: Medium - affects cloud-connected users

**Comment Position Updates with Concurrent Edits:**

- What's not tested: Two users moving same comment pin simultaneously, comment on deleted item
- Files: `src/lib/stores/comments.svelte.ts`, `src/lib/server/comments.ts`
- Risk: Comment position conflicts, orphaned comments on deleted items
- Priority: Low - advanced collaboration scenario

## Known Issues

**Console Logging in Production:**

- Issue: Extensive console.log/error/warn calls throughout codebase, no logging level control
- Files: 50+ instances across stores, servers, components
- Impact: Console noise in production, security risk (logs may contain user data)
- Recommendation: Use structured logging library (pino, winston) with environment-based levels, no console in production builds

**Floorplan Analysis Type Casting:**

- Issue: Deserialized FloorplanAnalysisData cast without runtime validation
- Files: `src/lib/server/floorplan-analyses.ts` (line 95)
- Problem: If API returns unexpected shape, cast hides error until runtime
- Current state: Works because data is generated by same system, but fragile if external integration added

**Missing Null Checks in Item Rendering:**

- Issue: Multiple places return null or empty arrays for item data without fallback UI
- Files: `src/lib/stores/project.svelte.ts` (lines 272, 295, 407, 481, etc.)
- Impact: Unexpected null values can cause component rendering errors
- Current mitigation: Components check for null/empty before rendering
- Recommendation: Use discriminated unions instead of null returns to make states explicit

---

_Concerns audit: 2026-02-17_
