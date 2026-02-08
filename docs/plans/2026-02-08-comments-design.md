# Comments Feature Design

## Overview

Add collaborative commenting to the floorplan planner. Two types of comments:
- **Canvas pin comments** — anchored to a location on the floorplan
- **Item comments** — attached to a specific furniture item

All comments are threaded (support replies) and sync in real-time via WebSocket.

## Data Model

### `comments` table

| Column     | Type              | Notes                                    |
|------------|-------------------|------------------------------------------|
| id         | uuid (PK)         |                                          |
| projectId  | uuid (FK)         |                                          |
| branchId   | uuid (FK)         | Comments are scoped to a branch          |
| authorId   | uuid (FK → users) |                                          |
| type       | enum              | `'canvas'` or `'item'`                   |
| itemId     | uuid (FK, nullable)| Set when type is `'item'`               |
| x          | float (nullable)  | Canvas coordinate for pin comments       |
| y          | float (nullable)  | Canvas coordinate for pin comments       |
| resolved   | boolean           | Default false                            |
| createdAt  | timestamp         |                                          |
| updatedAt  | timestamp         |                                          |

### `commentReplies` table

| Column    | Type              | Notes                          |
|-----------|-------------------|--------------------------------|
| id        | uuid (PK)         |                                |
| commentId | uuid (FK)         |                                |
| authorId  | uuid (FK → users) |                                |
| body      | text              |                                |
| createdAt | timestamp         |                                |

The top-level `comments` row has no `body`. The first reply in the thread is the initial message. This keeps the model uniform — every message is a reply.

## Permissions

- **Editors and owners** can create comments and replies
- **Viewers** can see comments but cannot create or reply
- Server validates role before accepting any comment action

## Canvas UI

### Pin Comments

- Small numbered circles rendered on a dedicated Konva layer (above furniture, below UI overlay)
- 24px on desktop, 32px on mobile (larger tap target)
- Shows author's initial inside the circle
- Muted indigo accent color by default
- Click/tap a pin opens the comment panel with the thread

### Creating Canvas Comments

**Desktop:**
- "Add comment" toolbar button enters placement mode
- Next canvas click drops the pin and opens the thread panel

**Mobile:**
- "Add comment" enters placement mode with a crosshair/target fixed at screen center
- User pans the canvas to position the target
- "Place" button confirms location (avoids conflict with tap-to-pan gestures)
- "Cancel" button exits without placing
- After placing, bottom sheet opens with reply input focused and keyboard ready

### Item Comments

- When an item is selected, the detail panel shows a "Comments" tab/section
- Lists threads attached to that item with reply input
- Small comment count badge on items that have comments (visible when comments toggled on)

### Visibility Toggle

- Added to toolbar alongside existing walls/doors toggle
- Hides/shows all pin markers and item comment badges
- State is per-user, local only (not synced)

### Comment Panel

**Desktop:** Sidebar panel
**Mobile:** Bottom sheet

Contents:
- Thread: author initial/avatar, name, timestamp, message body
- Reply input at the bottom
- "Resolve" button to mark thread done (dims/hides the pin)
- "Show resolved" filter to view resolved threads

### Mobile Considerations

- Reply input sticks above keyboard (using `visualViewport` API for iOS keyboard handling)
- Long messages scroll within the sheet
- No hover states — all interactions are tap-based
- All comment panels use bottom sheet, never sidebar

## Real-time Sync

Extend existing WebSocket system with events:

| Event                 | Payload                              |
|-----------------------|--------------------------------------|
| `comment:created`     | Comment + first reply                |
| `reply:created`       | Reply + parent commentId             |
| `comment:resolved`    | commentId + resolved state           |
| `comment:unresolved`  | commentId + resolved state           |
| `comment:deleted`     | commentId                            |

### Behavior

- Optimistic local update, then broadcast to other connected members on the same branch
- Comments are append-only (no editing) — no conflict resolution needed
- Resolve toggle uses last-write-wins (acceptable for a boolean toggle)
- Server validates editor/owner role before accepting WebSocket events

## In-app Notifications

- Unread badge indicator in the UI for new comments since last viewed
- Per-user, per-project tracking of last-seen comment timestamp
- No email notifications

## Scope

### In scope
- Canvas pin comments with numbered markers
- Item-attached comments
- Threaded replies
- Resolve/unresolve threads
- Visibility toggle (hide all comments)
- Real-time sync via WebSocket
- In-app unread badge
- Mobile-first placement mode

### Out of scope (future)
- Email notifications
- Comment editing/deletion by author
- @mentions and tagging
- Emoji reactions
- File attachments in comments
