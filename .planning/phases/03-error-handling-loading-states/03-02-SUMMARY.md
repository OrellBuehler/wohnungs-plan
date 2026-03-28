---
phase: 03-error-handling-loading-states
plan: 02
subsystem: ui
tags: [skeleton, loading-states, offline, badge, animate-pulse, svelte]

requires:
  - phase: 02-string-extraction
    provides: i18n message infrastructure for new keys
provides:
  - skeleton loading states on all data-fetching views
  - OfflineBadge component for offline sync queue visibility
affects: []

tech-stack:
  added: []
  patterns: [skeleton loading with animate-pulse bg-muted, offline status badge pattern]

key-files:
  created:
    - src/lib/components/shared/OfflineBadge.svelte
  modified:
    - src/routes/projects/[id]/history/+page.svelte
    - src/routes/projects/[id]/+page.svelte
    - messages/en.json
    - messages/de.json

key-decisions:
  - 'History page skeleton uses Table.Root/Row/Cell for consistent styling with data table'
  - 'OfflineBadge placed in project detail header only (home page has no sync context)'

patterns-established:
  - 'Skeleton loading: use animate-pulse with bg-muted rounded-md inside Table/Card containers'
  - 'Shared components: src/lib/components/shared/ for cross-page reusable UI'

requirements-completed: [VISD-03, ERRH-07]

duration: 6min
completed: 2026-02-21
---

# Phase 03 Plan 02: Skeleton Loading & Offline Badge Summary

**Skeleton table loading for history page and OfflineBadge component showing pending sync count when offline**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-21T13:19:51Z
- **Completed:** 2026-02-21T13:25:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- History page now shows 6 skeleton table rows matching column layout while loading (previously just text)
- Created OfflineBadge component that shows pending change count when user is offline
- Added i18n keys for offline status in both English and German
- Verified project detail and home page skeletons already existed with animate-pulse

## Task Commits

Each task was committed atomically:

1. **Task 1: Add skeleton loading states to history page** - `450ab8d` (feat)
2. **Task 2: Add offline sync queue badge to header** - `ed0882a` (feat)

## Files Created/Modified

- `src/lib/components/shared/OfflineBadge.svelte` - Badge showing pending changes count when offline
- `src/routes/projects/[id]/history/+page.svelte` - Skeleton table rows replacing text loading indicator
- `src/routes/projects/[id]/+page.svelte` - OfflineBadge wired into project header
- `messages/en.json` - Added offline_pending_changes and offline_status keys
- `messages/de.json` - Added German translations for offline keys

## Decisions Made

- History page skeleton uses actual Table components (Table.Root, Table.Row, Table.Cell) to match the data table structure
- OfflineBadge uses Badge variant="outline" for subtle appearance that disappears when online
- Placed OfflineBadge in project detail header only since the home page has no sync/offline context
- Project detail and home page skeletons were already complete (verified, no changes needed)

## Deviations from Plan

None - plan executed exactly as written. The plan noted that project detail and home page skeletons might already exist, and they did.

## Issues Encountered

- Paraglide compilation needed manual regeneration with correct outdir (`./src/lib/paraglide`) for new i18n keys to be recognized by type checker

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All skeleton loading states in place across views
- Offline badge ready for user testing
- Plan 03-03 can proceed independently

---

_Phase: 03-error-handling-loading-states_
_Completed: 2026-02-21_
