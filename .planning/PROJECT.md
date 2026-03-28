# Wohnungs-Plan

## What This Is

A floorplanner PWA for planning apartment and house layouts. Users upload floorplans, place furniture with real dimensions and prices, create layout variants via branches, collaborate in real-time, and work offline. Supports AI-assisted planning via MCP integration with Claude.

## Core Value

Users can visually plan and iterate on their apartment/house layout with accurate dimensions, seeing exactly what fits where.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Canvas-based floorplan editor with Konva — existing
- ✓ Item placement with dimensions, position, rotation, color, price — existing
- ✓ Floorplan image upload with scale calibration — existing
- ✓ Multiple layout variants via git-like branches — existing
- ✓ Project list with thumbnails and CRUD — existing
- ✓ User authentication via Infomaniak OIDC — existing
- ✓ Real-time collaboration with WebSocket cursors — existing
- ✓ Offline support with IndexedDB and sync queue — existing
- ✓ PWA with service worker caching — existing
- ✓ Project sharing with roles (owner/editor/viewer) — existing
- ✓ Anonymous share links — existing
- ✓ Comment threads pinned to floorplan locations — existing
- ✓ Item change history tracking — existing
- ✓ MCP server with 20+ tools for AI integration — existing
- ✓ OAuth 2.0 server with PKCE for MCP clients — existing
- ✓ Item image gallery with thumbnails — existing
- ✓ Distance indicators between items — existing
- ✓ Mobile-responsive layout with bottom sheet — existing
- ✓ PDF floorplan upload support — existing
- ✓ L-shape item support — existing
- ✓ Grid snapping and canvas controls — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Full i18n with Paraglide (English + German), language switcher
- [ ] Improved mobile touch interactions and responsive layouts
- [ ] Visual design polish (colors, spacing, typography)
- [ ] Better error handling, loading states, and empty states

### Out of Scope

- Native mobile app — web PWA is sufficient
- Additional languages beyond EN/DE — can add later, infrastructure supports it
- URL-based locale routing — using cookie strategy instead
- Major new features — this milestone is polish only

## Context

- Mature codebase with ~127 Svelte files, substantial test coverage
- Paraglide i18n work already started — plan exists at `docs/plans/paraglide-i18n.md`, worktree at `.worktrees/paraglide-i18n/`
- Previous mobile optimization work completed (see `docs/finished/mobile-optimization.md`)
- Known tech debt: large component files (FloorplanCanvas 1402 lines, project store 1378 lines, MCP server 1617 lines)
- Canvas performance adequate for typical use, not optimized for 100+ items

## Constraints

- **Tech stack**: SvelteKit + Svelte 5, Drizzle ORM, PostgreSQL, Bun runtime — established, no changes
- **i18n library**: Paraglide.js — already chosen and partially integrated
- **Package manager**: Bun only (never npm/pnpm/yarn)
- **UI components**: shadcn-svelte — existing component library
- **Deployment**: Docker on Alpine with Bun

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision                                      | Rationale                                                     | Outcome   |
| --------------------------------------------- | ------------------------------------------------------------- | --------- |
| Paraglide.js for i18n                         | Compiled approach, tree-shakable, type-safe message functions | — Pending |
| Cookie-based locale (no URL prefix)           | Simpler routing, no breaking changes to existing URLs         | — Pending |
| Flat snake_case message keys with area prefix | Consistent, easy to search, avoids nested JSON complexity     | — Pending |

---

_Last updated: 2026-02-17 after initialization_
