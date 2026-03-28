---
phase: 02-string-extraction
verified: 2026-02-18T22:51:33Z
status: human_needed
score: 11/12 must-haves verified
re_verification: false
human_verification:
  - test: 'Confirm German plural form for item count in ItemList'
    expected: "With 1 item visible: '1 Objekt' OR '1 Element'; with 2+ items: '2 Objekte' OR '2 Elemente'"
    why_human: "item_list_count (ICU plural key) is unused. item_list_title uses 'Objekte ({count})' which is always grammatically plural. Human verifier approved but the pluralization mechanism differs from plan intent."
---

# Phase 02: String Extraction Verification Report

**Phase Goal:** Every user-visible string in the app is translated into both English and German with no raw English visible in the German UI
**Verified:** 2026-02-18T22:51:33Z
**Status:** human_needed (11/12 must-haves verified; 1 item needs human clarification)
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                        | Status    | Evidence                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | formatDecimal() returns locale-correct decimal separators (comma for DE, dot for EN)                         | VERIFIED  | format.ts:14 uses `new Intl.NumberFormat(getLocale(), ...)`                                                                                                                                                                                                                                                            |
| 2   | formatDimension() returns locale-formatted dimension string with x separator and cm unit                     | VERIFIED  | format.ts:21 uses `Number.isInteger` branch then formatDecimal(n, 1)                                                                                                                                                                                                                                                   |
| 3   | formatRelativeTime() returns translated relative time using paraglide message keys                           | VERIFIED  | format.ts:27 calls m.time_just_now(), m.time_minutes_ago(), m.time_hours_ago(), m.time_days_ago()                                                                                                                                                                                                                      |
| 4   | formatPrice() uses Intl.NumberFormat with getLocale() instead of .toFixed(2)                                 | VERIFIED  | currency.ts:30 uses `new Intl.NumberFormat(getLocale(), ...)`                                                                                                                                                                                                                                                          |
| 5   | All message keys needed by Plans 02 and 03 exist in both en.json and de.json                                 | VERIFIED  | 407 keys in both files (exact match); all canvas*\*, history*_, online*users*_, image*viewer*\* keys confirmed                                                                                                                                                                                                         |
| 6   | Project page sidebar labels, dialog strings, and button text all display in German when locale is DE         | VERIFIED  | +page.svelte uses m.project_sidebar_group_collaboration(), m.project_sidebar_toggle_on/off(), m.project_change_floorplan_title(), m.branch_delete_title() etc. No raw English strings found.                                                                                                                           |
| 7   | History page column headers, filter labels, pagination, and empty states display in German when locale is DE | VERIFIED  | history/+page.svelte uses m.history_column_time/user/item/action/field/change(), m.history_filter_items_all(), m.history_filter_sources_all(), m.history_loading(), m.history_empty(), m.history_previous(), m.history_next()                                                                                          |
| 8   | History page relative timestamps display as 'vor X Minuten' in German locale                                 | VERIFIED  | history/+page.svelte imports formatRelativeTime from format.ts; hand-rolled relativeTime() removed                                                                                                                                                                                                                     |
| 9   | HistoryActionBadge shows translated action and source labels in German                                       | VERIFIED  | HistoryActionBadge.svelte has mapping function using m.history_action_create/update/delete() and m.history_source_mcp/user()                                                                                                                                                                                           |
| 10  | Canvas context menu, zoom controls, and scale bar display in German when locale is DE                        | VERIFIED  | FloorplanCanvas.svelte:1305-1400 uses m.canvas_zoom_in/out/reset_view/lock/unlock_zoom/rotate_left/right/remove_from_plan/close_menu/scale_bar()                                                                                                                                                                       |
| 11  | Canvas dimension labels use locale-correct decimal comma in German (e.g., '3,5 x 2 cm')                      | VERIFIED  | FloorplanCanvas.svelte:1146 uses formatDimension(item.width, item.height); distance indicators use formatDecimal()                                                                                                                                                                                                     |
| 12  | Item count uses correct plural form ('1 Element', '2 Elemente' in DE)                                        | UNCERTAIN | item_list_count key with ICU plural syntax exists in both locale files but is NOT called anywhere in src/. ItemList uses item_list_title ("Objekte ({count})") which is always grammatically plural in German but lacks ICU singular/plural branching. Human verifier approved but mechanism differs from plan intent. |

**Score:** 11/12 truths verified (1 uncertain - needs human confirmation)

---

### Required Artifacts

| Artifact                                                | Expected                                                           | Status             | Details                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/utils/format.ts`                               | formatDecimal, formatDimension, formatRelativeTime utilities       | VERIFIED           | All 3 functions exported; use Intl.NumberFormat(getLocale()); import m.\* for time keys                                                     |
| `src/lib/utils/currency.ts`                             | Locale-aware formatPrice                                           | VERIFIED           | Uses Intl.NumberFormat(getLocale()); no .toFixed(2)                                                                                         |
| `messages/en.json`                                      | All English message keys including canvas, history, sidebar, items | VERIFIED           | 407 keys; canvas*\*, history_column*_, history*action*_, online*users*_, image*viewer*_, item_list_count all present                        |
| `messages/de.json`                                      | All German message keys matching en.json                           | VERIFIED           | 407 keys (exact match to en.json); all German translations present                                                                          |
| `src/routes/projects/[id]/+page.svelte`                 | Fully i18n-wired project detail page                               | VERIFIED           | imports `* as m from '$lib/paraglide/messages'`; no raw English strings found for sidebar, dialogs, buttons                                 |
| `src/routes/projects/[id]/history/+page.svelte`         | Fully i18n-wired history page                                      | VERIFIED           | imports m._ and formatRelativeTime; all column headers, filters, pagination, empty states use m._()                                         |
| `src/lib/components/projects/HistoryActionBadge.svelte` | Translated action/source badge                                     | VERIFIED           | imports m._; actionLabel() maps create/update/delete to m.history*action*_(); source badge uses m.history_source_mcp/user()                 |
| `src/lib/components/canvas/FloorplanCanvas.svelte`      | Translated canvas text (context menu, zoom, dimensions, scale)     | VERIFIED           | imports m.\* and formatDimension/formatDecimal; all context menu items, zoom titles, scale bar, dimension labels, distance indicators wired |
| `src/lib/components/items/ItemList.svelte`              | Locale-formatted total cost and plural item count                  | VERIFIED (partial) | Uses formatPrice(totalCost, displayCurrency) for total; item count via item_list_title with German "Objekte" (always plural form)           |
| `src/lib/components/projects/ProjectCard.svelte`        | Translated relative time on project cards                          | VERIFIED           | Imports formatRelativeTime from format.ts; local hand-rolled function removed                                                               |
| `src/lib/components/canvas/ScaleCalibration.svelte`     | Translated zoom controls                                           | VERIFIED           | imports m.\*; zoom buttons use m.canvas_zoom_in/out/reset_view()                                                                            |
| `src/lib/components/canvas/CanvasControls.svelte`       | Locale-formatted scale display                                     | VERIFIED           | imports m.\* and formatDecimal; scale display uses formatDecimal(scale, 2)                                                                  |
| `src/lib/components/items/ItemCard.svelte`              | Locale-aware price and dimension display                           | VERIFIED           | Uses formatPrice(item.price, item.priceCurrency) and formatDimension(item.width, item.height)                                               |
| `src/lib/components/items/ItemBottomSheet.svelte`       | Locale-aware price and dimension display                           | VERIFIED           | Uses formatPrice and formatDimension; all strings wired to m.\*()                                                                           |
| `src/lib/components/items/ImageViewer.svelte`           | Translated aria-label                                              | VERIFIED           | Uses m.image_viewer_view_image({ index: i + 1 }) for dots and m.item_form_image_alt() for alt text                                          |
| `src/lib/components/projects/ProjectListDialog.svelte`  | Locale-aware date formatting                                       | VERIFIED           | Uses toLocaleDateString(getLocale(), ...) with explicit locale                                                                              |
| `src/lib/components/sharing/ShareLinkList.svelte`       | Locale-aware date formatting                                       | VERIFIED           | Uses toLocaleString(getLocale()) with explicit locale                                                                                       |
| `src/lib/components/collaboration/OnlineUsers.svelte`   | Translated fallback names                                          | VERIFIED           | Uses m.online_users_fallback() and m.online_users_anonymous()                                                                               |

---

### Key Link Verification

| From                                               | To                          | Via                                                            | Status | Details                                                                                                                                 |
| -------------------------------------------------- | --------------------------- | -------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/utils/format.ts`                          | `$lib/paraglide/runtime`    | getLocale() for Intl.NumberFormat locale                       | WIRED  | Line 1: `import { getLocale } from '$lib/paraglide/runtime'`                                                                            |
| `src/lib/utils/format.ts`                          | `$lib/paraglide/messages`   | m.time\_\* message functions for relative time                 | WIRED  | Line 2: `import * as m from '$lib/paraglide/messages'`; used at lines 33-36                                                             |
| `src/lib/utils/currency.ts`                        | `$lib/paraglide/runtime`    | getLocale() for Intl.NumberFormat locale                       | WIRED  | Line 1: `import { getLocale } from '$lib/paraglide/runtime'`; used at line 30                                                           |
| `src/routes/projects/[id]/+page.svelte`            | `$lib/paraglide/messages`   | m.\* function calls replacing all hardcoded strings            | WIRED  | import at line 11; m.project_sidebar_group_collaboration(), m.project_sidebar_toggle_on/off() etc. verified at lines 429, 455, 473, 479 |
| `src/routes/projects/[id]/history/+page.svelte`    | `src/lib/utils/format.ts`   | formatRelativeTime replacing hand-rolled English relative time | WIRED  | import at line 34; used in cell render at line 155                                                                                      |
| `src/lib/components/canvas/FloorplanCanvas.svelte` | `src/lib/utils/format.ts`   | formatDimension for canvas dimension labels                    | WIRED  | import at line 42; used at line 1146                                                                                                    |
| `src/lib/components/items/ItemCard.svelte`         | `src/lib/utils/currency.ts` | formatPrice for locale-aware price display                     | WIRED  | import at line 3; used at line 28                                                                                                       |
| `src/lib/components/projects/ProjectCard.svelte`   | `src/lib/utils/format.ts`   | formatRelativeTime replacing hand-rolled English relative time | WIRED  | import at line 10; used at line 33                                                                                                      |

---

### Requirements Coverage

| Requirement | Source Plan(s)      | Description                                                                   | Status                     | Evidence                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------- | ----------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I18N-02     | 02-02, 02-03, 02-04 | All UI strings display in the selected language (no raw English in German UI) | SATISFIED                  | Project page, history page, canvas components, item components, sharing components all use m.\*() calls. No raw English strings found in any audited component. Human verifier confirmed.                                                                                                                                                        |
| I18N-04     | 02-01, 02-03        | Numbers and measurements formatted per locale (3,5 m in DE, 3.5 m in EN)      | SATISFIED                  | formatDecimal and formatDimension use Intl.NumberFormat(getLocale()); formatPrice uses Intl.NumberFormat(getLocale()); .toFixed(2) eliminated from all item/canvas components                                                                                                                                                                    |
| I18N-05     | 02-01, 02-02        | Dates and relative times formatted per locale ("vor 2 Minuten" in DE)         | SATISFIED                  | formatRelativeTime produces "vor X Min./Std./T." in DE via m.time_minutes/hours/days_ago(); toLocaleString(getLocale()) used in ShareLinkList; toLocaleDateString(getLocale()) in ProjectListDialog and history page                                                                                                                             |
| I18N-06     | 02-04               | Form validation messages translated                                           | SATISFIED (human verified) | HTML `lang="%lang%"` attribute in app.html set dynamically via hooks.server.ts. Browser validation messages follow lang attribute. Human verifier confirmed German validation messages on Test 7.                                                                                                                                                |
| I18N-10     | 02-01, 02-03        | German plural forms handled correctly                                         | NEEDS HUMAN                | item_list_count key with ICU plural syntax ("1 Element / 2 Elemente") exists in both locale files but is NEVER called. ItemList uses item_list_title ("Objekte ({count})") which is always plural in German but has no singular/plural branching. Human verifier approved 02-04 but the mechanism may produce "1 Objekte" instead of "1 Objekt". |

**Orphaned requirements check:** REQUIREMENTS.md maps I18N-02, I18N-04, I18N-05, I18N-06, I18N-10 to Phase 2. All five appear in plan frontmatter. No orphaned requirements.

---

### Anti-Patterns Found

| File                                                      | Line         | Pattern                                                        | Severity | Impact                                                                                                                                                        |
| --------------------------------------------------------- | ------------ | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/sharing/ShareLinkList.svelte`         | 46           | `return 'Invalid date'` hardcoded English                      | Info     | Shown to user only when date parsing fails (malformed server data). Out of scope for this phase (error strings are Phase 3 territory).                        |
| `src/lib/components/sharing/ShareLinkList.svelte`         | 62, 126, 144 | `'Failed to load/create/revoke share links'` hardcoded English | Info     | API error messages caught in catch blocks and displayed directly. Not translated. Out of Phase 2 scope (Phase 3 ERRH-01).                                     |
| `src/lib/components/auth/ImportLocalProjectsModal.svelte` | 121          | `toLocaleDateString()` without getLocale()                     | Warning  | This component was not in Phase 2's file scope. Date will use system locale not app locale. Out of plan scope.                                                |
| `src/lib/components/canvas/ScaleCalibration.svelte`       | 414          | `.toFixed(0)` for pixel label                                  | Info     | Internal calibration display (`${lineLength.toFixed(0)}px`), not a user-facing locale-sensitive measurement. Acceptable.                                      |
| `messages/en.json` + `messages/de.json`                   | 444          | `item_list_count` key exists but is never called               | Warning  | ICU plural key created per plan but ItemList uses item_list_title instead. Plural behavior relies on German word "Objekte" always being grammatically plural. |

---

### Human Verification Required

**This phase already passed human verification (Plan 02-04 approved).** The following item requires focused re-confirmation:

#### 1. German Plural Form for Item Count

**Test:** Switch to German locale. Open a project with exactly 1 item in the list.
**Expected:** The item list title should show a grammatically correct German singular or plural count, e.g., "1 Objekt" (singular) or acceptable plural "Objekte (1)".
**Why human:** `item_list_title` in de.json is `"Objekte ({count})"` — this hardcodes the plural word "Objekte". With 1 item it would display "Objekte (1)" not "1 Objekt". The original plan intent was to use `item_list_count` with ICU plural syntax (`"1 Element"` vs `"2 Elemente"`), but that key was created and not wired. The human verifier approved the phase, but the specific plural test (Test 6 in 02-04) may have been run with multiple items only. This confirmation should take 2 minutes.
**Note:** If "Objekte (1)" is acceptable UX, the phase can be considered passed. If strict singular/plural is required, a gap plan is needed to wire `item_list_count` in ItemList.

---

### Gaps Summary

No blocking gaps were found. All artifacts exist and are fully wired. All key links verified. All commits confirmed (bd270ec, 0c6e394, 02740c2, 2ce75f4, e15412e, f01dcc6).

The one uncertain item (I18N-10 plural) was explicitly human-approved in Plan 02-04, but the mechanism used (hardcoded German plural word in message template) differs from the plan's specified approach (ICU plural with `item_list_count`). The `item_list_count` key was created but never wired. This is a minor discrepancy worth one human confirmation — it does not block any subsequent phases.

---

_Verified: 2026-02-18T22:51:33Z_
_Verifier: Claude (gsd-verifier)_
