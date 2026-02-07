# Plan

Unify thumbnails into a single "project preview" pipeline: generate from canvas (floorplan + placed items), persist it as the canonical preview for the default/main branch, and use that same preview in both the projects overview and shared project metadata. Keep safe fallbacks so projects without a generated preview still render cleanly.

## Scope
- In: Main/default-branch thumbnail generation policy, overview card image source switch, sharing/SEO image source alignment, API validation/security for thumbnail writes, validation/testing.
- Out: Full server-side rendering engine for thumbnails, retroactive bulk regeneration for all historical projects, redesign of sharing UI flows.

## Action items
[ ] Define a canonical preview field in metadata by extending `src/lib/types/index.ts` (`ProjectMeta`) with `thumbnailUrl` (keep `floorplanUrl` as fallback).
[ ] Update cloud project listing in `src/lib/server/projects.ts` and `src/routes/api/projects/+server.ts` to return `thumbnailUrl` (e.g. `/api/images/thumbnails/{projectId}`) alongside existing `floorplanUrl`.
[ ] Update overview rendering in `src/lib/components/projects/ProjectCard.svelte` to use thumbnail-first logic:
Cloud: `thumbnailUrl ?? floorplanUrl`
Local: IndexedDB `getThumbnail(projectId)` fallback to `getLocalFloorplanUrl(projectId)`
[ ] Enforce "main/default branch only" thumbnail updates in `src/routes/projects/[id]/+page.svelte` by checking active branch before saving/uploading thumbnail and including `branchId` in cloud thumbnail POST payload.
[ ] Harden `src/routes/api/thumbnails/+server.ts` to require authenticated project access and verify `branchId` matches the project default/main branch before accepting writes.
[ ] Improve thumbnail freshness in `src/lib/components/canvas/FloorplanCanvas.svelte` by triggering debounced generation on placed-item geometry changes (position/rotation/shape/size), not only `items.length`.
[ ] Reuse the same preview for sharing by introducing a unified preview endpoint (e.g. `src/routes/api/images/previews/[projectId]/+server.ts`) with fallback order `thumbnail -> floorplan -> default OG`, then point `src/routes/projects/[id]/+page.server.ts` SEO image to that endpoint.
[ ] Align export helper with live thumbnail endpoint in `src/lib/utils/export.ts` (current cloud fetch path should match `/api/images/thumbnails/{projectId}`).
[ ] Validate with `bun check` and manual scenarios:
Main branch edit updates overview thumbnail.
Non-main branch edit does not overwrite main preview.
Local and cloud cards both show canvas-based preview.
Shared project URL resolves to the same preview image.

## Open questions
- Should "main branch" be identified strictly by name `Main` or by default branch ordering (oldest branch ID)?
- If no generated thumbnail exists yet, do you want fallback to floorplan or directly to generic OG image?
- Do you want branch-specific thumbnails later (e.g. per-layout previews), or only one canonical main/default preview per project?
