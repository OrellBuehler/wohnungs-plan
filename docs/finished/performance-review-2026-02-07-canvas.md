# Canvas Performance Review (2026-02-07)

Scope: project view canvas interaction performance (pan/zoom) at `src/routes/projects/[id]/+page.svelte` and `src/lib/components/canvas/FloorplanCanvas.svelte`.

## Findings

1) High - Parent page is updated on every pan/zoom frame via two-way viewport binding
- Evidence: `src/lib/components/canvas/FloorplanCanvas.svelte:127-134` updates `viewportCenter` in an `$effect` that depends on `panX`, `panY`, `zoom`; parent binds this in `src/routes/projects/[id]/+page.svelte:883`.
- Why this hurts: every interaction frame propagates state to the full route component tree (header, side panel, history UI, etc.), not just the canvas.
- Current usage: parent consumes this value only for item placement at `src/routes/projects/[id]/+page.svelte:648-650`.
- Improvements:
  - Keep viewport center local to canvas and expose a pull API (`getViewportCenterNatural()`) when placing an item.
  - If push is preferred, throttle to ~10 Hz or emit only on interaction end.
  - Avoid object recreation each frame unless value changed by a minimum threshold.

2) High - Pan/zoom redraw path is expensive for large scenes
- Evidence: interaction updates stage transform at high frequency (`src/lib/components/canvas/FloorplanCanvas.svelte:346-372`, `src/lib/components/canvas/FloorplanCanvas.svelte:628-637`, `src/lib/components/canvas/FloorplanCanvas.svelte:796-803`).
- Rendering cost drivers:
  - Per-item shadows on all furniture (`src/lib/components/canvas/FloorplanCanvas.svelte:871-875`, `src/lib/components/canvas/FloorplanCanvas.svelte:885-889`).
  - Two text labels per item (`src/lib/components/canvas/FloorplanCanvas.svelte:896-918`).
  - Grid rendered as many individual nodes (`src/lib/components/canvas/FloorplanCanvas.svelte:813-830`).
- Improvements:
  - Split static and dynamic content into separate layers; cache static floorplan + grid.
  - Disable/reduce shadow blur while panning/zooming, then restore on idle.
  - Hide/decimate labels while moving or when zoomed out.
  - Replace line-by-line grid nodes with a pattern-based grid render.

3) High - Input handling is not frame-coalesced
- Evidence: mouse and wheel handlers mutate reactive state per raw event (`src/lib/components/canvas/FloorplanCanvas.svelte:346-372`, `src/lib/components/canvas/FloorplanCanvas.svelte:628-637`).
- Why this hurts: modern mice/trackpads can emit event rates well above display refresh, causing redundant work.
- Improvements:
  - Accumulate deltas and apply state updates in `requestAnimationFrame`.
  - Coalesce wheel events into one zoom update per frame.
  - Keep latest pointer state only; drop intermediate events.

4) Medium - Geometry computations do not scale with item count
- Evidence:
  - Overlap detection is O(n^2): `src/lib/components/canvas/FloorplanCanvas.svelte:688-690`, `src/lib/utils/geometry.ts:283-299`.
  - Distance indicator pipeline does per-item box/math and full sort: `src/lib/components/canvas/FloorplanCanvas.svelte:693-720`.
- Why this hurts: not the main pan bottleneck, but becomes visible with many items and while dragging/selecting.
- Improvements:
  - Use a spatial index (uniform grid / R-tree) for overlap and nearest-neighbor queries.
  - Recompute overlap only for the active/changed item during drag.
  - For nearest 2 neighbors, use partial selection instead of sorting all candidates.

5) Medium - Persistence path is too expensive for high-frequency movement updates
- Evidence:
  - Frontend `updateItem` clones all items and sends PATCH (`src/lib/stores/project.svelte.ts:867-887`).
  - Backend PATCH writes item history and touches project timestamps (`src/lib/server/items.ts:195-226`).
- Why this hurts: desktop drag currently commits at drag end, but mobile long-press drag and any future continuous updates can overload client+server.
- Improvements:
  - Maintain transient drag position in canvas-local state; commit once on drag end.
  - Add debounced/batched position updates for collaborative syncing.
  - Optionally avoid writing history entries for intermediate drag samples.

## Prioritized Implementation Plan

1. Remove per-frame parent binding churn (`viewportCenter` decoupling).
2. Add RAF-based pan/zoom event coalescing.
3. Add interaction-mode rendering degradation (shadows/labels/grid simplification during move).
4. Layer/caching refactor for static content.
5. Optimize geometry algorithms for high item counts.
6. Add batched movement persistence and history strategy.

## Suggested Success Metrics

- Maintain >= 55 FPS during continuous pan on a populated project.
- Keep main-thread work < 12 ms/frame p95 while panning.
- Limit route-level (non-canvas) reactive updates to near-zero during pan/zoom.
- Ensure no burst of PATCH requests during continuous pointer movement.

## Open Questions

- Typical item counts in real projects (p50/p95) to size algorithmic optimizations.
- Target devices/monitors (especially HiDPI) to decide on adaptive pixel ratio policy.
- Whether history must track every intermediate move or only final committed position.
