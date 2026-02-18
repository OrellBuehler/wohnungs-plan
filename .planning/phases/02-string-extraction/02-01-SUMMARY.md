---
phase: 02-string-extraction
plan: 01
subsystem: i18n
tags: [intl, number-format, paraglide, locale, formatting]

requires:
  - phase: 01-i18n-infrastructure
    provides: "Paraglide runtime with getLocale(), message files en.json/de.json, time_* message keys"
provides:
  - "formatDecimal, formatDimension, formatRelativeTime utilities in format.ts"
  - "Locale-aware formatPrice using Intl.NumberFormat in currency.ts"
  - "All message keys needed for Plans 02, 03, and 04 in both en.json and de.json"
affects: [02-02, 02-03, 02-04]

tech-stack:
  added: []
  patterns:
    - "Intl.NumberFormat with getLocale() for all numeric formatting"
    - "formatDecimal/formatDimension as shared formatting utilities"

key-files:
  created: []
  modified:
    - src/lib/utils/format.ts
    - src/lib/utils/currency.ts
    - messages/en.json
    - messages/de.json

key-decisions:
  - "Used Intl.NumberFormat over manual formatting for locale-correct decimal separators"
  - "formatDimension uses plain String(n) for integers, formatDecimal(n,1) for decimals"
  - "Skipped duplicate history keys that already existed with equivalent names (e.g. history_filter_items_all already covers history_filter_all_items)"

patterns-established:
  - "Intl.NumberFormat(getLocale(), opts) pattern for all locale-sensitive number formatting"
  - "Message key naming: area_component_detail with snake_case"

requirements-completed: [I18N-04, I18N-05, I18N-10]

duration: 3min
completed: 2026-02-18
---

# Phase 02 Plan 01: Formatting Utilities and Message Keys Summary

**Locale-aware formatDecimal/formatDimension/formatRelativeTime utilities using Intl.NumberFormat + getLocale(), plus 30 new message keys for canvas, history, sidebar, and item count across en.json and de.json**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T20:35:41Z
- **Completed:** 2026-02-18T20:39:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added formatDecimal, formatDimension, formatRelativeTime to format.ts using Intl.NumberFormat with paraglide getLocale()
- Updated formatPrice in currency.ts to use Intl.NumberFormat instead of .toFixed(2)
- Added 30 new message keys to both en.json and de.json covering canvas controls, history table, project sidebar, online users, image viewer, and item count plural form

## Task Commits

Each task was committed atomically:

1. **Task 1: Create locale-aware formatting utilities and update currency formatting** - `bd270ec` (feat)
2. **Task 2: Add all missing message keys to en.json and de.json** - `0c6e394` (feat)

## Files Created/Modified
- `src/lib/utils/format.ts` - Added formatDecimal, formatDimension, formatRelativeTime with Intl.NumberFormat and paraglide messages
- `src/lib/utils/currency.ts` - Updated formatPrice to use Intl.NumberFormat with getLocale() instead of .toFixed(2)
- `messages/en.json` - Added 30 new English message keys for canvas, history, sidebar, online users, image viewer, item count
- `messages/de.json` - Added 30 matching German message keys

## Decisions Made
- Used Intl.NumberFormat over manual formatting for locale-correct decimal separators (comma for DE, dot for EN)
- formatDimension uses plain String(n) for integers to avoid unnecessary decimal places (e.g. "3 x 2 cm" not "3.0 x 2.0 cm")
- Skipped adding duplicate history keys that already existed with equivalent names (e.g. history_filter_items_all already present, no need for history_filter_all_items)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing type errors (4) in plural message key usage across components (auth import, canvas comments, comment thread). These are not caused by this plan's changes and are out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All formatting utilities ready for Plans 02 and 03 to wire into components
- All message keys pre-populated so Plans 02 and 03 can focus purely on component wiring
- Build and type-check pass (pre-existing errors only)

## Self-Check: PASSED

All 5 files verified present. Both task commits (bd270ec, 0c6e394) found in git log.

---
*Phase: 02-string-extraction*
*Completed: 2026-02-18*
