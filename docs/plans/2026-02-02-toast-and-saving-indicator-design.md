# Toast Notifications and Saving Indicator Design

## Overview

Add user feedback for:
1. Error notifications via toast
2. Cloud sync status indicator next to project name

## Saving Indicator

**Location:** Inline with project name in header, separated by `·`

**States:**
- **Hidden** - Not authenticated, no sync in progress, or local-only project
- **"Saving..."** - Cloud API call in flight
- **"Saved"** - Shown for 2 seconds after successful sync, then hides

**Implementation:**

Add to `project.svelte.ts`:
- `syncCount` - Number of pending API calls
- `lastSyncedAt` - Timestamp of last successful sync
- `isSyncing` - Derived: `syncCount > 0`
- Helper functions to wrap fetch calls and track status

Header display (authenticated, non-local projects only):
```
Project Name · Saving...
Project Name · Saved
Project Name (hidden when idle)
```

## Error Toasts

**Library:** Sonner via shadcn-svelte

**Setup:**
- Add `<Toaster />` to `+layout.svelte`
- Use `toast.error(message)` for errors

**Error scenarios:**

| Context | Error | Message |
|---------|-------|---------|
| Project sync | Failed to save | "Failed to save changes" |
| Project load | Failed to load | "Failed to load project" |
| Floorplan upload | Failed to upload | "Failed to upload floorplan" |
| Item sync | Failed to save item | "Failed to save item" |
| Invite send | Failed to create | "Failed to send invite" |
| Invite accept | Failed to accept | "Failed to accept invite" |

## Files to Modify

1. `src/lib/stores/project.svelte.ts` - Sync status tracking, error handling
2. `src/routes/+layout.svelte` - Add Toaster component
3. `src/routes/projects/[id]/+page.svelte` - Saving indicator in header
4. Invite-related components - Error toasts for invite operations
