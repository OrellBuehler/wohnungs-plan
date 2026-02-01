# Projects Overview Page Design

## Overview

Add a dedicated projects overview page at `/` where users can see all their projects with visual previews, storage status (cloud/local), and sharing status. The editor moves to `/projects/[id]`.

## Route Structure

| Route | Purpose |
|-------|---------|
| `/` | Projects overview (new) |
| `/projects/[id]` | Project editor (moved from `/`) |

### Navigation Flow

1. User lands on `/` → sees all projects
2. Click project → navigates to `/projects/[id]`
3. Header in editor shows "← Projects" back link
4. New project → creates, then navigates to `/projects/[id]`
5. Direct link to `/projects/[id]` works; invalid/no-access → redirect to `/` with error

## Page Layout

```
┌─────────────────────────────────────────────┐
│  Header: Logo          [Sign In] / [Avatar] │
├─────────────────────────────────────────────┤
│                                             │
│  My Projects                    [+ New]     │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ ░░░░░░░ │ │ ░░░░░░░ │ │ ░░░░░░░ │       │
│  │ ░thumb░ │ │ ░thumb░ │ │  empty  │       │
│  │ ░░░░░░░ │ │ ░░░░░░░ │ │  state  │       │
│  ├─────────┤ ├─────────┤ ├─────────┤       │
│  │ Name    │ │ Name    │ │ Name    │       │
│  │ ☁️ 2d ago│ │ 💾 1h   │ │ ☁️ 5m   │       │
│  │ 👥      ⋮│ │        ⋮│ │        ⋮│       │
│  └─────────┘ └─────────┘ └─────────┘       │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ Sign in to sync & share your projects│  │  ← Unauthenticated only
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Responsive Grid

- Desktop: 3-4 cards per row
- Tablet: 2-3 cards
- Mobile: 1-2 cards

## Project Card

### Information Displayed

- Floorplan thumbnail (16:9 crop, centered) or placeholder icon
- Project name (truncated if long)
- Storage icon: ☁️ (cloud) or 💾 (local-only)
- Relative timestamp: "2 days ago", "just now"
- Shared indicator: 👥 shown if project has members (cloud only)
- Overflow menu button (⋮)

### Overflow Menu Actions

| Action | Cloud Project | Local Project |
|--------|---------------|---------------|
| Open | Navigate to editor | Navigate to editor |
| Share | Opens ShareDialog | Disabled + tooltip: "Sync to cloud to share" |
| Sync to cloud | Hidden | Visible if logged in |
| Delete | Confirmation dialog | Confirmation dialog |

## Behaviors

### New Project

- Creates in cloud (if authenticated) or IndexedDB (if not)
- Default name: "Untitled Project"
- Immediately navigates to `/projects/[id]`

### Delete

- Confirmation dialog with project name
- Warning: "This cannot be undone. All items and floorplans will be permanently deleted."
- Buttons: [Cancel] [Delete]

### Sync to Cloud

- Only shown for local projects when authenticated
- Uploads project + items + floorplan to PostgreSQL
- Removes from IndexedDB on success
- Toast: "Project synced to cloud"

## Data Loading

### Sources

- Authenticated: `/api/projects` + IndexedDB merged
- Unauthenticated: IndexedDB only

### Sorting

- All projects by `updatedAt` descending
- Cloud and local mixed together

### Loading State

- 3-6 skeleton cards with shimmer animation

### Empty States

| Scenario | Display |
|----------|---------|
| No projects | "No projects yet" + [Create your first project] button |
| Has unsynced local (after login) | Banner: "Sync your local projects to the cloud?" |
| Error loading | "Couldn't load projects" + [Retry] button |

### Thumbnails

- Cloud: `/api/images/floorplans/[projectId]/[filename]`
- Local: Load from IndexedDB blob
- Fallback: Placeholder blueprint icon

## Header Changes

### On `/` (Overview)

- App logo
- User menu (Sign In button or avatar dropdown)

### On `/projects/[id]` (Editor)

- "← Projects" back link
- Project name
- Share button
- User menu

## Components to Create

- `src/routes/+page.svelte` - Rewrite as projects overview
- `src/routes/projects/[id]/+page.svelte` - Move editor here
- `src/lib/components/projects/ProjectCard.svelte` - New card component
- `src/lib/components/projects/ProjectGrid.svelte` - Grid container
- `src/lib/components/projects/EmptyState.svelte` - Empty state display

## Components to Modify

- `src/lib/components/layout/Header.svelte` - Context-aware header
- `src/lib/stores/project.svelte.ts` - Add multi-project list fetching
