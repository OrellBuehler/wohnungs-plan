# Mobile Optimization Plan

## Overview
Improve mobile experience by fixing bugs, increasing touch target compliance, and exposing desktop-only features on mobile via a header overflow menu.

## Tasks

### 1. Fix home page viewport height (Trivial)
- **File**: `src/routes/+page.svelte:160`
- **Change**: Replace `h-screen` with `style="height: 100dvh;"` to match the project page pattern
- **Why**: `100vh` on mobile Safari doesn't account for the dynamic URL bar

### 2. Switch mobile detection to matchMedia (Trivial)
- **File**: `src/routes/projects/[id]/+page.svelte` (onMount block ~line 414)
- **Change**: Replace `window.addEventListener('resize', ...)` with `window.matchMedia('(max-width: 767px)')` + `change` listener
- **Why**: Only fires on breakpoint crossing instead of every pixel, matches the pattern already used in the share page

### 3. Fix PWA manifest icons (Trivial)
- **File**: `static/manifest.json`
- **Change**: Split `"purpose": "any maskable"` into separate entries — one `"any"` and one `"maskable"` per size
- **Why**: Combined purpose uses the same icon for both contexts; maskable icons need safe-zone padding that looks odd as regular icons

### 4. Increase touch targets in ItemBottomSheet (Low)
- **File**: `src/lib/components/items/ItemBottomSheet.svelte:124-144`
- **Change**: Quick action buttons from `h-9 w-9` (36px) to `h-11 w-11` (44px), icon size from 16 to 18
- **Why**: 44px is the iOS Human Interface Guidelines minimum for touch targets

### 5. Add mobile header overflow menu (Medium)
- **Files**: New component + modify `src/routes/projects/[id]/+page.svelte`
- **Design**:
  - Add a `MoreVertical` (⋮) icon button in the header, visible only on mobile (`md:hidden`)
  - Opens a DropdownMenu with items:
    - **Branch section**: Current branch name as label, list of branches to switch, "New branch" option
    - **Actions section**: Share, History, Refresh, Rename
  - Reuse existing handler functions (handleBranchSelect, handleCreateBranch, refreshProject, etc.)
  - Keep it simple: no nested submenus, flat list with separators
- **Why**: Branch switching, share, history, refresh, and rename are all desktop-only currently

## Status

- [x] Task 1: Fix home page viewport height
- [x] Task 2: Switch mobile detection to matchMedia
- [x] Task 3: Fix PWA manifest icons
- [x] Task 4: Increase touch targets
- [x] Task 5: Add mobile header overflow menu

## Completed
All tasks done. Commits:
- `b0be21a` fix(mobile): use 100dvh instead of h-screen on home page
- `76f6f2c` refactor(mobile): use matchMedia instead of resize listener
- `ec6ab8e` fix(pwa): split manifest icons into separate any/maskable entries
- `a15ede2` fix(mobile): increase touch targets in ItemBottomSheet to 44px
- `97268b1` feat(mobile): add header overflow menu for project actions
