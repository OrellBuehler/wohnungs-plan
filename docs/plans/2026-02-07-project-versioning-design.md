# Project Versioning Design

## Overview

Two versioning features for projects:

1. **Change history** — per-field change tracking on items with owner-only revert
2. **Branches** — git-like branch model for comparing furniture configurations (Layout A vs Layout B)
3. **Authorization hardening** — restrict grid size and floorplan changes to project owner

## Scope

- **Items only** — branches and change history track furniture items
- Floorplan and project settings remain branch-independent (shared across all branches)

## Data Model

### New table: `branches`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| project_id | uuid | FK → projects, cascade delete |
| name | text | e.g. "Main", "Layout B" |
| forked_from_id | uuid | FK → branches (nullable, null = empty start) |
| created_by | uuid | FK → users |
| created_at | timestamp | |

### New table: `item_changes`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| project_id | uuid | FK → projects, cascade delete |
| branch_id | uuid | FK → branches, cascade delete |
| item_id | uuid | The item that changed (kept even if item deleted) |
| user_id | uuid | FK → users (nullable for local/anonymous) |
| action | text | 'create' / 'update' / 'delete' |
| field | text | e.g. 'x', 'color', 'name' (null for create/delete) |
| old_value | text | JSON-encoded previous value (null for create) |
| new_value | text | JSON-encoded new value (null for delete) |
| created_at | timestamp | |

### Modified table: `items`

- Add `branch_id` (uuid, FK → branches, cascade delete)
- Keep `project_id` for efficient queries

## Branch Mechanics

### Default branch

- On project creation, a "Main" branch is auto-created
- Existing projects get a migration that creates a "Main" branch and assigns all current items to it
- The project table does NOT store an "active branch" — that's a per-user client-side concern

### Active branch tracking

- Stored client-side via URL query param (`/projects/[id]?branch=[branchId]`)
- Default: if no branch specified, load the oldest branch ("Main")
- Each collaborator can independently view different branches

### Branch operations

- **Create**: fork from any existing branch, or start empty. Editor+ role required.
- **Rename**: editor+ can rename any branch
- **Delete**: editor+ can delete any branch EXCEPT the last remaining one
- **Switch**: anyone (including viewers) can switch between branches

### Floorplan & project settings

- Branch-independent — shared across all branches
- Only the owner can change grid size and floorplan (new authorization rule)

### WebSocket collaboration

- Cursor positions and item locks scoped to a branch
- Room key changes from `project:{projectId}` to `project:{projectId}:branch:{branchId}`
- Item CRUD broadcasts include `branch_id` — clients ignore events for other branches

## Change History

### Recording changes

- Every item mutation inserts row(s) into `item_changes`
- **Updates**: one row per changed field, same `created_at` timestamp
- **Creates**: one row, action `create`, `new_value` = full item JSON
- **Deletes**: one row, action `delete`, `old_value` = full item JSON

### UI grouping (client-side only)

- Group changes by (user, item, time window ~2s) into "action groups"
- Display: "Orell moved Couch" (collapsed) → expand to see individual field changes
- No DB concept of groups — API returns flat rows, frontend groups them

### Reverting (owner only)

- Owner selects an action group, can expand and deselect individual changes
- Revert applies the inverse: sets each field back to `old_value`
- Reverting a create → deletes the item
- Reverting a delete → re-creates the item from stored snapshot
- Reverts generate new change history entries (tracked and revertable)

### Retention

- No automatic cleanup — keep all history
- Retention policy can be added later if needed

## API Endpoints

### Branch endpoints

- `GET /api/projects/[id]/branches` — list all branches
- `POST /api/projects/[id]/branches` — create `{ name, forkFromBranchId? }`
- `PATCH /api/projects/[id]/branches/[branchId]` — rename `{ name }`
- `DELETE /api/projects/[id]/branches/[branchId]` — delete (fails if last branch)

### Item endpoints (branch-scoped, replaces old `/items/` routes)

- `GET /api/projects/[id]/branches/[branchId]/items` — list items
- `POST /api/projects/[id]/branches/[branchId]/items` — create item
- `PATCH /api/projects/[id]/branches/[branchId]/items/[itemId]` — update item
- `DELETE /api/projects/[id]/branches/[branchId]/items/[itemId]` — delete item

### Change history endpoints

- `GET /api/projects/[id]/branches/[branchId]/history?limit=50&offset=0` — flat list, newest first

### Revert endpoint

- `POST /api/projects/[id]/branches/[branchId]/revert` — owner only. Body: `{ changeIds: string[] }`

### Authorization additions

- `PATCH /api/projects/[id]` (grid size) — owner only
- `POST/PATCH/DELETE /api/projects/[id]/floorplan` — owner only

## MCP Integration

### Branch-aware tools

All existing item tools gain a required `branch_id` parameter. New tools added:

```
add_furniture_item(project_id, branch_id, name, width, height, ...)
update_furniture_item(project_id, branch_id, item_id, ...)
delete_furniture_item(project_id, branch_id, item_id)
list_furniture_items(project_id, branch_id)
list_branches(project_id)
create_branch(project_id, name, fork_from_branch_id?)
get_change_history(project_id, branch_id, limit?, offset?)
```

### MCP as a regular user

- OAuth token tied to a user — MCP uses that user's identity
- Change history records the MCP user's `user_id`
- Permission checks apply normally (viewer can't edit, non-owner can't change floorplan/grid, only owner can revert)

### Branch specification

- Every item operation must explicitly include `branch_id` (no default fallback)
- MCP client must call `list_branches` first to discover branches
- Prevents accidental edits to the wrong branch

## Migration Strategy

### Database migration

1. Create `branches` table
2. Create `item_changes` table
3. Add `branch_id` column to `items` (nullable initially)
4. For each existing project: insert a "Main" branch, set all its items' `branch_id` to that branch
5. Make `branch_id` NOT NULL
6. Add index on `(branch_id)`

### No history backfill

History starts from the migration point. Existing items have no recorded history.

### Client migration

- Update all frontend API calls to branch-scoped URLs
- Store active `branchId` in URL query param
- If no `?branch` param, resolve to oldest branch (Main)
- Update IndexedDB schema to store items keyed by branch
- Update offline sync queue to include `branchId`

### MCP migration

- Update existing tools to require `branch_id`
- Add new branch and history tools
- Breaking change for MCP clients

### WebSocket migration

- Change room key to `project:{projectId}:branch:{branchId}`
- Clients join room for their active branch only
