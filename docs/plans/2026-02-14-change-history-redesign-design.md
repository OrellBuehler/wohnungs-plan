# Change History Redesign

## Problem

The current change history is a custom modal overlay (`HistoryDialog.svelte`) that doesn't use shadcn components and provides a cramped experience for reviewing changes. On mobile it's unnecessary clutter.

## Decision

Replace the dialog with a full-page route on desktop using shadcn-svelte's Data Table (TanStack Table). Hide history completely on mobile.

## Route & Layout

- **New route:** `/projects/[id]/history`
- **SSR:** `+page.server.ts` loads initial history data server-side
- **Header:** Project name, back button (→ `/projects/[id]`), "Revert Selected" action button
- **Mobile:** History button/link completely hidden — no route access, no menu entry
- **Desktop nav:** Existing "History" button in project toolbar becomes a `<a>` link to the history route

## Data Table

### Dependencies

- Install shadcn components: `table`, `data-table`
- Add `@tanstack/table-core`

### Columns

| Column    | Key        | Description                                                                 |
|-----------|------------|-----------------------------------------------------------------------------|
| Checkbox  | select     | Row selection for revert (select-all in header)                             |
| Timestamp | createdAt  | Relative time ("2 min ago") with absolute time tooltip                      |
| User      | userName   | Who made the change                                                         |
| Item      | itemId     | Item name (resolved from items list)                                        |
| Action    | action     | Badge: "created" / "updated" / "deleted"                                    |
| Field     | field      | Which field changed (empty for create/delete)                               |
| Change    | old→new    | Old value → New value, formatted with units where applicable                |

### Filtering

- shadcn `Select` dropdown for filtering by **item name**
- shadcn `Select` dropdown for filtering by **user**
- Both sit in a toolbar row above the table

### Pagination

- TanStack built-in pagination (Previous/Next buttons, row count)
- Default page size: 50

### Visual Grouping

Changes within the same 2-second window by the same user on the same item get subtle visual treatment:
- No separator line between grouped rows
- Repeated user/timestamp cells are slightly muted (lighter text)

### Row Selection & Revert

- Checkbox column with select-all header
- "Revert Selected" button in page header, active when rows are selected
- Revert calls existing `revertHistoryChanges` store function
- After revert, table data reloads

## Files to Create/Modify

### New files
- `src/routes/projects/[id]/history/+page.server.ts` — load history + items SSR
- `src/routes/projects/[id]/history/+page.svelte` — history page with data table

### Modified files
- `src/routes/projects/[id]/+page.svelte` — change History button to link, hide on mobile
- `src/lib/components/projects/HistoryDialog.svelte` — delete (replaced by page)

### Components to install
- `bunx shadcn-svelte@latest add table`
- `bun add @tanstack/table-core`

## What's NOT Changing

- History API endpoint (`/api/projects/[id]/branches/[branchId]/history`)
- Revert API endpoint (`/api/projects/[id]/branches/[branchId]/revert`)
- `ItemChange` type
- Store functions (`getItemHistory`, `revertHistoryChanges`)
