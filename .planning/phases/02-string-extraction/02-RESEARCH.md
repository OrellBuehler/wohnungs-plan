# Phase 2: String Extraction - Research

**Researched:** 2026-02-17
**Domain:** i18n string extraction, locale-aware formatting (Paraglide JS v2 + Intl APIs)
**Confidence:** HIGH

## Summary

Phase 1 established Paraglide JS v2 infrastructure with cookie-based locale strategy, a working LanguageSwitcher, and ~412 message keys already extracted in both `en.json` and `de.json`. A thorough audit of the codebase reveals that **29 of ~35 application component files already import and use `$lib/paraglide/messages`**. However, significant gaps remain:

1. **Two major route files** (`projects/[id]/+page.svelte` and `projects/[id]/history/+page.svelte`) contain dozens of hardcoded English strings not yet wired to message functions.
2. **Canvas labels** (dimension text like `${item.width} x ${item.height} cm`, distance indicators, scale bar) are hardcoded in `FloorplanCanvas.svelte`.
3. **Number/measurement formatting** uses plain `.toFixed(2)` and string concatenation everywhere, with no locale-aware decimal separator.
4. **Relative time** is hand-rolled with English suffixes (`"5m ago"`, `"2h ago"`) in two separate locations, not using the existing `time_*` message keys.
5. **Form validation** relies on browser-native `required` attribute messages, which are already locale-aware in modern browsers (Chrome/Firefox respect `<html lang="de">`).
6. **Plural forms** are partially implemented (4 keys use ICU `{count, plural, one {...} other {...}}`) but the item list title `"Items ({count})"` does not use plural-aware formatting for German ("1 Element" vs "2 Elemente").

**Primary recommendation:** Systematically work through the app route by route, replacing hardcoded strings with `m.*()` calls, creating a shared `formatDimension()`/`formatNumber()` utility that uses `Intl.NumberFormat` with the current Paraglide locale, and replacing both hand-rolled `relativeTime()` functions with the existing `time_*` message keys.

<phase_requirements>

## Phase Requirements

| ID      | Description                                   | Research Support                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I18N-02 | All UI strings display in selected language   | Audit identified specific files with remaining hardcoded strings: `projects/[id]/+page.svelte` (sidebar action labels, dialog strings, branch UI), `history/+page.svelte` (column headers, filter labels, relative time, pagination), `FloorplanCanvas.svelte` (context menu, zoom controls, scale bar), `HistoryActionBadge.svelte` (action/source labels), `OnlineUsers.svelte` (fallback names). All other component files already use paraglide messages. |
| I18N-04 | Numbers and measurements formatted per locale | `formatPrice()` in `currency.ts` uses `.toFixed(2)` with no locale awareness. Canvas dimension labels use template literals (`${width} x ${height} cm`). The `ItemBottomSheet` and `ItemList` also use `.toFixed(2)`. Solution: use `Intl.NumberFormat` with `getLocale()` for decimal formatting. German uses comma as decimal separator (3,5 not 3.5).                                                                                                      |
| I18N-05 | Dates and relative times formatted per locale | Two hand-rolled `relativeTime()` functions exist (in `ProjectCard.svelte` and `history/+page.svelte`) returning English strings like "5m ago". Existing `time_*` message keys in both locales support this already. `toLocaleDateString()` calls need explicit locale parameter from `getLocale()`.                                                                                                                                                           |
| I18N-06 | Form validation messages translated           | Forms use HTML `required` attribute. Modern browsers display validation messages in the document language (set via `<html lang="de">`). Phase 1 already sets this via `transformPageChunk`. No custom validation messages exist. Browser-native validation is sufficient.                                                                                                                                                                                     |
| I18N-10 | German plural forms handled correctly         | ICU plural syntax already works (4 existing keys). Need to add plural-aware keys for item counts and any other countable nouns. German has two plural categories: `one` and `other`.                                                                                                                                                                                                                                                                          |

</phase_requirements>

## Standard Stack

### Core

| Library              | Version                | Purpose                         | Why Standard                                                          |
| -------------------- | ---------------------- | ------------------------------- | --------------------------------------------------------------------- |
| @inlang/paraglide-js | v2 (already installed) | Compiled i18n message functions | Already in use; type-safe, tree-shakable                              |
| Intl.NumberFormat    | Built-in               | Locale-aware number formatting  | Browser-native, no dependency; supports decimal separators per locale |
| Intl.DateTimeFormat  | Built-in               | Locale-aware date formatting    | Browser-native; used with `getLocale()` for toLocaleDateString        |

### Supporting

| Library                               | Version            | Purpose                       | When to Use                                           |
| ------------------------------------- | ------------------ | ----------------------------- | ----------------------------------------------------- |
| ICU MessageFormat (via inlang plugin) | Already configured | Plural rules in message files | For `{count, plural, one {...} other {...}}` patterns |

### Alternatives Considered

| Instead of              | Could Use                       | Tradeoff                                                                                                      |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Intl.NumberFormat       | Hand-rolled decimal replacement | Intl is standard, handles edge cases (thousands separator, etc.)                                              |
| Intl.RelativeTimeFormat | Message keys with interpolation | Message keys already exist and give more control over format; Intl.RelativeTimeFormat produces longer strings |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/lib/
├── paraglide/           # Generated by Paraglide (already exists)
│   ├── messages.ts      # Generated message functions
│   ├── runtime.ts       # getLocale(), setLocale()
│   └── server.ts        # paraglideMiddleware
├── utils/
│   ├── format.ts        # NEW: locale-aware formatting utilities
│   └── currency.ts      # MODIFY: use Intl.NumberFormat
messages/
├── en.json              # MODIFY: add missing keys
└── de.json              # MODIFY: add missing keys
```

### Pattern 1: Locale-Aware Number Formatting Utility

**What:** A shared utility that formats numbers using the current Paraglide locale
**When to use:** Any place that displays a number to the user (prices, dimensions, counts)
**Example:**

```typescript
// src/lib/utils/format.ts
import { getLocale } from '$lib/paraglide/runtime';

export function formatDecimal(value: number, decimals: number = 2): string {
	return new Intl.NumberFormat(getLocale(), {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(value);
}

export function formatDimension(width: number, height: number): string {
	// Uses locale-aware decimal if needed (integers stay as-is)
	const w = Number.isInteger(width) ? String(width) : formatDecimal(width, 1);
	const h = Number.isInteger(height) ? String(height) : formatDecimal(height, 1);
	return `${w} × ${h} cm`;
}
```

### Pattern 2: Replacing Hardcoded Strings with Message Functions

**What:** Import `* as m from '$lib/paraglide/messages'` and replace string literals
**When to use:** Every user-visible string
**Example:**

```svelte
<!-- Before -->
<h1>Change History</h1>
<Button>Revert ({selectedCount})</Button>

<!-- After -->
<h1>{m.history_title()}</h1>
<Button>{m.history_revert_button({ count: selectedCount })}</Button>
```

### Pattern 3: Relative Time via Message Keys

**What:** Replace hand-rolled relativeTime functions with existing `time_*` message keys
**When to use:** ProjectCard.svelte and history/+page.svelte
**Example:**

```typescript
import * as m from '$lib/paraglide/messages';

function formatRelativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return m.time_just_now();
	if (minutes < 60) return m.time_minutes_ago({ count: minutes });
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return m.time_hours_ago({ count: hours });
	const days = Math.floor(hours / 24);
	return m.time_days_ago({ count: days });
}
```

### Pattern 4: Passing Locale to toLocaleDateString/toLocaleString

**What:** Always pass `getLocale()` as the locale argument
**When to use:** Every `toLocaleDateString()`, `toLocaleString()` call
**Example:**

```typescript
import { getLocale } from '$lib/paraglide/runtime';

// Before
new Date(iso).toLocaleDateString();

// After
new Date(iso).toLocaleDateString(getLocale());
```

### Anti-Patterns to Avoid

- **Hardcoded locale strings:** Never use `'de'` or `'en'` directly; always use `getLocale()`
- **Duplicating relativeTime logic:** There are currently TWO separate implementations; consolidate into one shared utility or use message keys directly
- **Forgetting canvas text:** Konva `Text` nodes use the `text` prop which is easy to overlook since it's not HTML
- **Ignoring aria-labels and titles:** These are user-visible for screen readers and must be translated

## Don't Hand-Roll

| Problem            | Don't Build                      | Use Instead                                  | Why                                                              |
| ------------------ | -------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| Decimal formatting | String `.replace('.', ',')`      | `Intl.NumberFormat(getLocale())`             | Handles thousands separators, edge cases, all locales            |
| Relative time      | Custom English-only function     | `time_*` message keys (already exist)        | Already translated in both locales                               |
| Plural forms       | `count === 1 ? 'item' : 'items'` | ICU `{count, plural, one {...} other {...}}` | Language-specific plural rules differ (some have >2 forms)       |
| Date formatting    | Manual date string building      | `toLocaleDateString(getLocale())`            | Handles locale date order (DD.MM.YYYY for DE, MM/DD/YYYY for EN) |

**Key insight:** The i18n infrastructure is already fully set up. This phase is purely a string extraction and formatting exercise - no new libraries, no architectural changes. The main risk is missing strings, not technical complexity.

## Common Pitfalls

### Pitfall 1: Missing Canvas/Konva Text Nodes

**What goes wrong:** Canvas labels rendered via Konva `<Text text={...}>` are not in the DOM and are easy to overlook during string audits.
**Why it happens:** Developers grep for HTML text content but miss programmatic text in `<Text>` components.
**How to avoid:** Specifically audit `FloorplanCanvas.svelte` for all `text={...}` props. Key locations: item name labels, dimension labels (`${width} × ${height} cm`), distance indicators (`${Math.round(indicator.distanceCm)} cm`), scale bar (`100 cm`).
**Warning signs:** German UI shows English measurement text on the canvas.

### Pitfall 2: Reactive Locale in Derived Values

**What goes wrong:** Formatted strings cached in `$derived()` don't update when locale changes.
**Why it happens:** Paraglide message functions auto-track locale, but raw `Intl.NumberFormat` calls don't trigger Svelte reactivity.
**How to avoid:** Either call formatting inside message functions, or ensure `getLocale()` is called within the reactive scope so Svelte tracks the dependency.
**Warning signs:** Switching language doesn't update number formats until page reload.

### Pitfall 3: Browser Validation Messages

**What goes wrong:** HTML5 `required` field messages appear in wrong language.
**Why it happens:** Browser uses `<html lang>` attribute to determine validation message language.
**How to avoid:** Phase 1 already sets `<html lang="%lang%">` via `transformPageChunk`. Verify this works by testing form submission in German locale. If browser validation messages are in English despite `lang="de"`, it's a browser issue (some browsers use OS language instead).
**Warning signs:** Submit form with empty required field and check the message language.

### Pitfall 4: Sidebar Action Labels from JavaScript Objects

**What goes wrong:** Action labels defined in `$effect()` as plain strings (`label: 'Share'`) are not reactive to locale changes.
**Why it happens:** The sidebar action groups are defined as object literals in the project page's `$effect`, using hardcoded English strings.
**How to avoid:** Use `m.*()` calls directly as label values. Since `$effect` re-runs when its dependencies change, and Paraglide messages auto-track locale, this will work correctly.
**Warning signs:** Sidebar action labels stay in English after switching to German.

### Pitfall 5: Forgetting the History Page

**What goes wrong:** The history page (`/projects/[id]/history/+page.svelte`) is a separate route that's easy to forget.
**Why it happens:** It's not linked from the main navigation, only accessible via a button on the project page.
**How to avoid:** Include it explicitly in the extraction plan.
**Warning signs:** Navigating to history page shows all-English UI in German locale.

## Code Examples

### Locale-Aware Price Formatting

```typescript
// src/lib/utils/currency.ts (modified)
import { getLocale } from '$lib/paraglide/runtime';

export function formatPrice(amount: number, currencyCode: CurrencyCode): string {
	const symbol = getCurrencySymbol(currencyCode);
	const formatted = new Intl.NumberFormat(getLocale(), {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
	return `${symbol}${formatted}`;
}
```

### Adding Missing Message Keys (example additions to en.json/de.json)

```json
// Keys needed for projects/[id]/+page.svelte sidebar actions
"project_sidebar_collaboration": "Collaboration"  / "Zusammenarbeit"
"project_sidebar_canvas": "Canvas"  / "Leinwand"

// Keys needed for FloorplanCanvas.svelte
"canvas_rotate_left": "Rotate Left"  / "Links drehen"
"canvas_rotate_right": "Rotate Right"  / "Rechts drehen"
"canvas_remove_from_plan": "Remove from Plan"  / "Vom Plan entfernen"
"canvas_zoom_in": "Zoom in"  / "Vergrössern"
"canvas_zoom_out": "Zoom out"  / "Verkleinern"
"canvas_reset_view": "Reset view"  / "Ansicht zurücksetzen"
"canvas_lock_zoom": "Lock zoom"  / "Zoom sperren"
"canvas_unlock_zoom": "Unlock zoom"  / "Zoom entsperren"
"canvas_close_menu": "Close menu"  / "Menü schliessen"
"canvas_scale_bar": "100 cm"  / "100 cm"

// Keys needed for history page
"history_action_create": "create"  / "erstellen"
"history_action_update": "update"  / "aktualisieren"
"history_action_delete": "delete"  / "löschen"
"history_source_user": "User"  / "Benutzer"
"history_source_mcp": "MCP"  / "MCP"

// Keys for item count plural
"item_list_count": "{count} {count, plural, one {item} other {items}}"
// de: "{count} {count, plural, one {Element} other {Elemente}}"
```

### Canvas Dimension Text with Locale

```svelte
<!-- FloorplanCanvas.svelte - before -->
<Text text={`${item.width} × ${item.height} cm`} ... />

<!-- After (using a helper) -->
<Text text={formatDimension(item.width, item.height)} ... />
```

## State of the Art

| Old Approach                           | Current Approach                           | When Changed         | Impact                                      |
| -------------------------------------- | ------------------------------------------ | -------------------- | ------------------------------------------- |
| `amount.toFixed(2)`                    | `Intl.NumberFormat(locale).format(amount)` | Always available     | Locale-correct decimal separators           |
| Hand-rolled relative time              | Paraglide message keys with params         | Phase 1 (keys exist) | Already translated, just need to wire up    |
| `toLocaleDateString()` (no locale arg) | `toLocaleDateString(getLocale())`          | Always available     | Explicit locale prevents OS-locale fallback |

## Audit: Remaining Hardcoded Strings by File

### HIGH PRIORITY (route pages with many hardcoded strings)

**`src/routes/projects/[id]/+page.svelte`** — NOT using paraglide messages

- Sidebar action group titles: `'Collaboration'`, `'Canvas'`
- Sidebar action labels: `'Share'`, `'Refresh'`, `'MCP Tools'`, `'Recalibrate Scale'`, `'Change Floorplan'`, `'Hide Grid'`/`'Show Grid'`, `'Disable Snap'`/`'Enable Snap'`
- Sidebar indicators: `'On'`, `'Off'`
- Header buttons: `Share`, `History`, `Comments`, `Refreshing...`, `Switching branch...`
- Branch dialog: `'Create Branch'`/`'Rename Branch'`, descriptions, `'Branch name'` placeholder, `'Cancel'`, `'Create'`/`'Save'`
- Confirm dialog: `'Delete Branch'`, `'Delete branch "..."?'`, `'Change Floorplan'`, `'Change floorplan? Item positions will be kept.'`, `'Delete Item'`, `'Delete this item?'`
- Branch button titles: `'Create branch'`, `'Rename branch'`, `'Delete branch'`
- Note: message keys for most of these ALREADY EXIST in en.json/de.json (branch*\*, project*_, item*delete*_, common\_\*) — they just need to be imported and wired up.

**`src/routes/projects/[id]/history/+page.svelte`** — NOT using paraglide messages

- Page title: `'Change History'`
- Button: `'Revert ({selectedCount})'`
- Filter labels: `'All items'`, `'All users'`, `'All sources'`, `'User'`, `'MCP'`
- Column headers: `'Time'`, `'User'`, `'Item'`, `'Action'`, `'Field'`, `'Change'`
- Loading/empty states: `'Loading history...'`, `'No change history yet.'`, `'No changes match the current filters.'`
- Pagination: `'{selected} of {total} row(s) selected'`, `'Previous'`, `'Next'`
- Relative time: hand-rolled with English suffixes
- Aria-labels: `'Select all'`, `'Select row'`
- Note: message keys for ALL of these already exist in en.json/de.json — they just need to be imported.

### MEDIUM PRIORITY (component-level gaps)

**`src/lib/components/canvas/FloorplanCanvas.svelte`**

- Context menu: `'Rotate Left'`, `'Rotate Right'`, `'Remove from Plan'`
- Zoom controls: `title="Zoom in"`, `title="Zoom out"`, `title="Reset view"`, `title="Lock zoom"`/`title="Unlock zoom"`
- Scale bar: `100 cm`
- Dimension labels: `${item.width} × ${item.height} cm` (canvas text)
- Distance indicators: `${Math.round(indicator.distanceCm)} cm`
- Aria-label: `'Close menu'`

**`src/lib/components/canvas/ScaleCalibration.svelte`**

- Zoom titles: `title="Zoom in"`, `title="Zoom out"`, `title="Reset view"`

**`src/lib/components/projects/HistoryActionBadge.svelte`**

- Action label: displays raw `{action}` string (create/update/delete) — needs translation
- Source label: `{viaMcp ? 'MCP' : 'User'}` — needs translation

**`src/lib/components/collaboration/OnlineUsers.svelte`**

- Fallback: `'User'`, `'Anonymous'`

**`src/lib/components/items/ImageViewer.svelte`**

- Aria-label: `'View image {i + 1}'`

### LOW PRIORITY (formatting-only changes, no new strings)

**`src/lib/utils/currency.ts`**

- `formatPrice()` uses `.toFixed(2)` — needs `Intl.NumberFormat`

**`src/lib/components/items/ItemList.svelte`**

- `totalCost.toFixed(2)` — needs locale formatting

**`src/lib/components/items/ItemCard.svelte`**

- `item.price.toFixed(2)` — needs locale formatting

**`src/lib/components/items/ItemBottomSheet.svelte`**

- `item.price.toFixed(2)` — needs locale formatting
- `${item.width} × ${item.height} cm` — needs locale formatting

**`src/lib/components/projects/ProjectCard.svelte`**

- `formatRelativeTime()` — hand-rolled English, needs to use `time_*` message keys

**`src/lib/components/projects/ProjectListDialog.svelte`**

- `toLocaleDateString(undefined, ...)` — needs explicit `getLocale()` parameter

**`src/lib/components/sharing/ShareLinkList.svelte`**

- `toLocaleString()` — needs explicit `getLocale()` parameter

**`src/lib/components/canvas/CanvasControls.svelte`**

- `scale.toFixed(2)` in the scale display — needs locale formatting

## Open Questions

1. **Canvas text reactivity**
   - What we know: Konva `<Text>` components accept a `text` prop. Using `m.*()` or `formatDimension()` in the prop should work reactively.
   - What's unclear: Whether Konva text re-renders efficiently when locale changes mid-session.
   - Recommendation: Test after implementation. If perf issues arise, locale change already triggers page reload (via `setLocale`), so this is likely fine.

2. **Action/history string translation**
   - What we know: The `action` field in history contains literal strings `'create'`, `'update'`, `'delete'` from the database.
   - What's unclear: Whether these should be translated at display time (map DB value to message key) or stored translated.
   - Recommendation: Translate at display time only. Database values stay in English; use a mapping function in the UI.

3. **Currency name translation**
   - What we know: `CURRENCIES` array has English names (`'US Dollar'`, `'Swiss Franc'`).
   - What's unclear: Whether these names are displayed to users (they appear in currency selector).
   - Recommendation: If displayed, add message keys. If only the code/symbol is shown, skip.

## Sources

### Primary (HIGH confidence)

- Codebase audit: direct file reads of all `.svelte` and `.ts` files in `src/`
- `/opral/inlang-paraglide-js` Context7 docs - plural syntax, runtime API, SvelteKit integration
- `/websites/inlang_m_gerre34r_library-inlang-paraglidejs` Context7 docs - getLocale/setLocale, overwriteGetLocale
- `messages/en.json` and `messages/de.json` - 412 existing message keys

### Secondary (MEDIUM confidence)

- MDN Intl.NumberFormat documentation (well-established API)
- Browser HTML5 validation message language behavior (based on `<html lang>`)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - no new libraries, all already installed
- Architecture: HIGH - patterns are straightforward string replacement + Intl APIs
- Pitfalls: HIGH - identified from direct codebase audit, not speculation
- Completeness of audit: HIGH - grepped all `.svelte` files for hardcoded strings, titles, aria-labels, placeholders

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable - no moving parts)
