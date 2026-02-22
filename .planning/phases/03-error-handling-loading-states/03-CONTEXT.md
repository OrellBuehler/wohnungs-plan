# Phase 3: Error Handling + Loading States - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Every API error surfaces to the user as a visible toast, upload progress is visible, destructive actions require confirmation dialogs, and data-fetching views show skeleton loading states. No silent failures anywhere in the app.

</domain>

<decisions>
## Implementation Decisions

### Toast & error behavior
- Toasts are inform-only — no retry buttons, user retries manually by repeating their action
- Multiple errors stack individually (Sonner default stacking), no deduplication
- Error toasts auto-dismiss after ~5 seconds, same as other toast types
- Network errors, save failures, and API errors all surface as toasts

### Upload progress
- Progress bar style (not spinner) shown in a persistent toast notification
- No cancel button — once started, upload runs to completion
- On upload failure: error toast appears, file stays selected so user can retry without re-selecting
- Applies to floorplan uploads and item image uploads

### Confirmation dialogs
- All destructive actions get a confirmation dialog (delete project, delete item, clear canvas, remove floorplan image, etc.)
- Replace all native browser `confirm()` calls with shadcn Dialog
- Direct and minimal copy: "Delete project?" with Delete / Cancel buttons
- Confirm/delete button uses red destructive variant, cancel is neutral

### Auth redirect
- Logged-out users visiting a project URL redirect to login page
- Simple notice: "Please log in to view this project" — no contextual details

### Loading & skeleton states
- Shimmer/pulse animated skeleton placeholders
- Simple card-shaped rectangles (no internal layout detail)
- All data-fetching views get skeletons (project list, project detail, item lists)
- Offline sync queue badge in header/navbar showing pending change count

### Claude's Discretion
- Toast position (responsive placement for desktop vs mobile)
- Exact shimmer animation implementation
- Which specific actions qualify as "destructive" beyond the obvious deletes
- Offline badge visual design and exact placement within header

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-error-handling-loading-states*
*Context gathered: 2026-02-19*
