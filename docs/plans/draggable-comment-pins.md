# Plan: Draggable Comment Pins

## Context
Comment pins placed on the canvas are static. Users want to reposition them by dragging, similar to how furniture items can be dragged. The `updateCommentPosition()` store function and PATCH API endpoint already exist from previous work.

## Changes

### 1. Make comment pins draggable — `src/lib/components/canvas/CommentsLayer.svelte`

- Import `updateCommentPosition` from comments store
- Add `projectId: string` prop (needed by `updateCommentPosition`)
- On each comment pin `<Group>`, add:
  - `draggable={!isMobile && !isPlacementMode()}`
  - `ondragend={(e) => handlePinDragEnd(comment, e)}`
- Add `handlePinDragEnd(comment, e)`:
  - Read `e.target.x()`, `e.target.y()`
  - Call `updateCommentPosition(projectId, comment.id, x, y)`

### 2. Forward projectId — `src/lib/components/canvas/FloorplanCanvas.svelte`

- Add `projectId: string` prop
- Pass `projectId` to `<CommentsLayer projectId={projectId} />`

### 3. Pass projectId — `src/routes/projects/[id]/+page.svelte`

- Pass `projectId={data.project.id}` to `<FloorplanCanvas>`

## Verification
1. `bun check` — no type errors
2. Desktop: drag a pinned comment to a new position → reload page → pin stays at new position
3. Mobile: pins not draggable, tap-to-select still works
4. During placement mode: pins not draggable
