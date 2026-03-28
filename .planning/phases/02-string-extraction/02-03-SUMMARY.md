---
phase: 02-string-extraction
plan: 03
subsystem: ui
tags: [i18n, paraglide, intl, svelte, locale-formatting]

requires:
  - phase: 02-01
    provides: 'formatDecimal, formatDimension, formatPrice, formatRelativeTime utilities and message keys'
provides:
  - 'All canvas components use paraglide messages for user-visible text'
  - 'All item components use locale-aware price and dimension formatting'
  - 'ProjectCard uses shared formatRelativeTime instead of hand-rolled English'
  - 'Date/time calls use explicit getLocale() parameter'
  - 'OnlineUsers shows translated fallback names'
affects: [02-04-string-extraction, 03-route-pages]

tech-stack:
  added: []
  patterns:
    - 'formatPrice(amount, currencyCode) for all price displays'
    - 'formatDimension(w, h) for all dimension labels'
    - 'getLocale() passed to toLocaleDateString/toLocaleString'

key-files:
  created: []
  modified:
    - 'src/lib/components/canvas/FloorplanCanvas.svelte'
    - 'src/lib/components/canvas/ScaleCalibration.svelte'
    - 'src/lib/components/canvas/CanvasControls.svelte'
    - 'src/lib/components/items/ItemList.svelte'
    - 'src/lib/components/items/ItemCard.svelte'
    - 'src/lib/components/items/ItemBottomSheet.svelte'
    - 'src/lib/components/items/ImageViewer.svelte'
    - 'src/lib/components/projects/ProjectCard.svelte'
    - 'src/lib/components/projects/ProjectListDialog.svelte'
    - 'src/lib/components/sharing/ShareLinkList.svelte'
    - 'src/lib/components/collaboration/OnlineUsers.svelte'

key-decisions:
  - 'Removed ProjectCard local formatRelativeTime entirely, replaced with shared utility from format.ts'
  - 'Used formatPrice for all price displays including totalCost (replaces getCurrencySymbol + toFixed pattern)'

patterns-established:
  - 'Price display pattern: formatPrice(amount, currencyCode) replaces symbol + toFixed(2)'
  - 'Dimension display pattern: formatDimension(w, h) replaces template literal interpolation'

requirements-completed: [I18N-02, I18N-04, I18N-10]

duration: 9min
completed: 2026-02-18
---

# Phase 02 Plan 03: Component String Extraction Summary

**Wired 11 components to paraglide messages and locale-aware formatting: canvas context menus, zoom controls, dimension labels, item prices, relative time, and fallback names**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-18T20:40:57Z
- **Completed:** 2026-02-18T20:50:15Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Canvas context menu, zoom controls, scale bar, dimension labels, and distance indicators all use paraglide messages or locale-aware formatting
- Item price displays consolidated from getCurrencySymbol + toFixed(2) to formatPrice across ItemList, ItemCard, ItemBottomSheet
- ProjectCard hand-rolled English relative time replaced with shared formatRelativeTime utility
- Date formatting calls use explicit getLocale() parameter in ProjectListDialog and ShareLinkList
- OnlineUsers fallback names use translated messages

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire canvas components** - `e15412e` (feat)
2. **Task 2: Wire item and miscellaneous components** - `f01dcc6` (feat)

## Files Created/Modified

- `src/lib/components/canvas/FloorplanCanvas.svelte` - Added m.\* for context menu, zoom titles, close menu; formatDimension for item labels; formatDecimal for distance indicators; m.canvas_scale_bar for scale bar
- `src/lib/components/canvas/ScaleCalibration.svelte` - Replaced zoom control title attributes with m.canvas_zoom_in/out/reset_view
- `src/lib/components/canvas/CanvasControls.svelte` - Added formatDecimal for scale px/cm display
- `src/lib/components/items/ItemList.svelte` - Replaced getCurrencySymbol + toFixed with formatPrice for total cost
- `src/lib/components/items/ItemCard.svelte` - Replaced getCurrencySymbol + toFixed with formatPrice; dimension text with formatDimension
- `src/lib/components/items/ItemBottomSheet.svelte` - Replaced getCurrencySymbol + toFixed with formatPrice; dimension text with formatDimension
- `src/lib/components/items/ImageViewer.svelte` - Added paraglide import; translated aria-label and alt text fallback
- `src/lib/components/projects/ProjectCard.svelte` - Removed local formatRelativeTime, imported shared utility from format.ts
- `src/lib/components/projects/ProjectListDialog.svelte` - Added getLocale() parameter to toLocaleDateString
- `src/lib/components/sharing/ShareLinkList.svelte` - Added getLocale() parameter to toLocaleString
- `src/lib/components/collaboration/OnlineUsers.svelte` - Replaced hardcoded 'User' and 'Anonymous' with m.online_users_fallback/anonymous

## Decisions Made

- Removed ProjectCard local formatRelativeTime entirely rather than keeping both -- shared utility produces locale-correct output via paraglide message keys
- Used formatPrice for all price displays including totalCost, consolidating the getCurrencySymbol + toFixed(2) pattern into a single locale-aware call

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added translated alt text fallback in ImageViewer**

- **Found during:** Task 2 (ImageViewer)
- **Issue:** ImageViewer had hardcoded `'Item image'` alt text fallback not mentioned in plan
- **Fix:** Replaced with `m.item_form_image_alt()` which already existed in message files
- **Files modified:** src/lib/components/items/ImageViewer.svelte
- **Verification:** No hardcoded English alt text remains
- **Committed in:** f01dcc6

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor addition for accessibility correctness. No scope creep.

## Issues Encountered

- Pre-existing type errors (4) related to ICU plural syntax in paraglide-generated types -- not caused by this plan's changes, same count before and after
- Pre-existing build failure (bun module resolution in db.ts) -- verified identical before changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All non-route-page components now use paraglide messages and locale-aware formatting
- Ready for 02-04 (route page string extraction) as the final component layer is complete

---

_Phase: 02-string-extraction_
_Completed: 2026-02-18_
