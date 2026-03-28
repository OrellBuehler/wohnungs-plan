# Phase 3: Error Handling + Loading States - Research

**Researched:** 2026-02-19
**Domain:** Error handling, toast notifications, upload progress, loading states, confirmation dialogs
**Confidence:** HIGH

## Summary

This phase adds user-visible error handling, upload progress, confirmation dialogs, auth redirects, skeleton loading states, and an offline sync badge. The project already has the key infrastructure in place: `svelte-sonner` (v1.0.7) is installed and the `<Toaster>` is rendered in `+layout.svelte`, `shadcn Dialog` is available and already used for delete confirmations on the home page and in the project page (via `openConfirmDialog`), and the `sync.svelte.ts` store tracks `pendingChanges` count. The primary work is wiring toast calls into existing error paths, replacing `console.error` silent failures with user-visible feedback, adding `XMLHttpRequest`-based upload progress, and extending skeleton patterns already started on the home page.

The biggest technical question was upload progress tracking with `fetch` (which has no upload progress API). The standard solution is `XMLHttpRequest` with `upload.onprogress`, which is well-supported and straightforward. The `toast.custom()` API in svelte-sonner supports rendering a custom Svelte component inside a toast, enabling a progress bar toast.

**Primary recommendation:** Use `svelte-sonner`'s `toast.error()` for all error surfaces, `XMLHttpRequest` for upload progress piped into a custom progress toast, extend the existing `openConfirmDialog` pattern to all destructive actions, and add a `pendingChanges` badge to the header/navbar.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Toasts are inform-only — no retry buttons, user retries manually by repeating their action
- Multiple errors stack individually (Sonner default stacking), no deduplication
- Error toasts auto-dismiss after ~5 seconds, same as other toast types
- Network errors, save failures, and API errors all surface as toasts
- Progress bar style (not spinner) shown in a persistent toast notification
- No cancel button — once started, upload runs to completion
- On upload failure: error toast appears, file stays selected so user can retry without re-selecting
- Applies to floorplan uploads and item image uploads
- All destructive actions get a confirmation dialog (delete project, delete item, clear canvas, remove floorplan image, etc.)
- Replace all native browser `confirm()` calls with shadcn Dialog
- Direct and minimal copy: "Delete project?" with Delete / Cancel buttons
- Confirm/delete button uses red destructive variant, cancel is neutral
- Logged-out users visiting a project URL redirect to login page
- Simple notice: "Please log in to view this project" — no contextual details
- Shimmer/pulse animated skeleton placeholders
- Simple card-shaped rectangles (no internal layout detail)
- All data-fetching views get skeletons (project list, project detail, item lists)
- Offline sync queue badge in header/navbar showing pending change count

### Claude's Discretion

- Toast position (responsive placement for desktop vs mobile)
- Exact shimmer animation implementation
- Which specific actions qualify as "destructive" beyond the obvious deletes
- Offline badge visual design and exact placement within header

### Deferred Ideas (OUT OF SCOPE)

None
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                               | Research Support                                                                                               |
| ------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| ERRH-01 | Network errors show user-visible toast message (no silent failures)       | `toast.error()` from svelte-sonner; wrap `authFetch` or add toast calls at each `catch` block in project store |
| ERRH-02 | Form submission errors displayed inline with the form                     | Svelte reactive state for field-level errors; validation messages already i18n-ready                           |
| ERRH-03 | Project load failure shows error with retry CTA                           | Home page already has error state with retry button; project detail page needs equivalent                      |
| ERRH-04 | Upload progress indicator for floorplan/image uploads                     | `XMLHttpRequest` with `upload.onprogress` + `toast.custom()` for progress bar toast                            |
| ERRH-05 | Destructive actions use shadcn Dialog confirmation (not native confirm()) | Existing `openConfirmDialog` pattern on project page + home page Dialog; audit all destructive actions         |
| ERRH-06 | 401 responses redirect to login with meaningful message                   | `authFetch` already redirects on 401; add query param `?reason=auth` and display message on login page         |
| ERRH-07 | Offline queue shows pending changes count badge                           | `getPendingChanges()` from sync store; render Badge in header/navbar                                           |
| VISD-03 | Loading skeletons on project list and data-fetching views                 | Home page already has skeleton cards; extend to project detail and item lists                                  |

</phase_requirements>

## Standard Stack

### Core

| Library       | Version           | Purpose              | Why Standard                                                                            |
| ------------- | ----------------- | -------------------- | --------------------------------------------------------------------------------------- |
| svelte-sonner | ^1.0.7            | Toast notifications  | Already installed, wraps Sonner for Svelte; supports error/success/promise/custom types |
| shadcn Dialog | (bits-ui ^2.15.5) | Confirmation dialogs | Already installed and used; project convention                                          |

### Supporting

| Library                  | Version       | Purpose                  | When to Use                                                            |
| ------------------------ | ------------- | ------------------------ | ---------------------------------------------------------------------- |
| XMLHttpRequest           | (browser API) | Upload progress tracking | For floorplan and item image uploads where progress feedback is needed |
| Tailwind `animate-pulse` | (built-in)    | Skeleton shimmer         | Already used on home page loading state                                |

### Alternatives Considered

| Instead of                | Could Use                | Tradeoff                                                                                                   |
| ------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| XMLHttpRequest for upload | fetch + ReadableStream   | Streams API has no upload progress — only download. XHR is the only browser API with `upload.onprogress`   |
| Custom progress toast     | toast.promise()          | `toast.promise()` only shows loading spinner, not a progress bar. Need `toast.custom()` for a progress bar |
| Individual toast calls    | Global fetch interceptor | Interceptor would be cleaner but harder to provide context-specific messages                               |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/sonner/          # Already exists — Toaster component
│   │   ├── ui/dialog/          # Already exists — Dialog components
│   │   ├── ui/badge/           # Already exists — for offline count badge
│   │   └── shared/
│   │       ├── ConfirmDialog.svelte  # Reusable confirmation dialog component
│   │       └── UploadProgress.svelte # Custom toast component for upload progress
│   ├── stores/
│   │   └── sync.svelte.ts      # Already has pendingChanges — expose reactively
│   └── utils/
│       └── upload.ts           # XHR upload helper with progress callback
```

### Pattern 1: Toast Error Surfacing

**What:** Replace `console.error` with `toast.error()` at every API failure point
**When to use:** Every `catch` block and `!response.ok` check in stores and components
**Example:**

```typescript
// src/lib/stores/project.svelte.ts
import { toast } from 'svelte-sonner';

// Before (silent failure):
} catch (error) {
  console.error('Failed to load remote projects:', error);
  return localMetas;
}

// After (user-visible):
} catch (error) {
  console.error('Failed to load remote projects:', error);
  toast.error(m.error_load_projects());
  return localMetas;
}
```

Source: svelte-sonner README — `toast.error(message)` API

### Pattern 2: XHR Upload with Progress

**What:** Replace `fetch` with `XMLHttpRequest` for file uploads to get progress events
**When to use:** `uploadFloorplan()` and `uploadItemImage()` in project store
**Example:**

```typescript
// src/lib/utils/upload.ts
export function uploadWithProgress(
	url: string,
	formData: FormData,
	onProgress: (percent: number) => void,
	headers?: Record<string, string>
): Promise<Response> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', url);

		if (headers) {
			for (const [key, value] of Object.entries(headers)) {
				xhr.setRequestHeader(key, value);
			}
		}

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				onProgress(Math.round((e.loaded / e.total) * 100));
			}
		};

		xhr.onload = () => {
			const response = new Response(xhr.responseText, {
				status: xhr.status,
				statusText: xhr.statusText
			});
			resolve(response);
		};

		xhr.onerror = () => reject(new Error('Upload failed'));
		xhr.send(formData);
	});
}
```

### Pattern 3: Progress Toast with Custom Component

**What:** Use `toast.custom()` to render a progress bar inside a persistent toast
**When to use:** During file uploads
**Example:**

```typescript
import { toast } from 'svelte-sonner';
import UploadProgress from '$lib/components/shared/UploadProgress.svelte';

const toastId = toast.custom(UploadProgress, {
	duration: Infinity, // Don't auto-dismiss during upload
	componentProps: { progress: 0, filename: file.name }
});

// Update progress:
toast.custom(UploadProgress, {
	id: toastId,
	duration: Infinity,
	componentProps: { progress: percent, filename: file.name }
});

// On complete:
toast.dismiss(toastId);
toast.success(m.upload_success());
```

Source: svelte-sonner README — `toast.custom(Component, options)` with `componentProps`

### Pattern 4: Reusable Confirmation Dialog

**What:** Extract the confirm dialog pattern into a reusable component
**When to use:** All destructive actions across the app
**Example:**

```svelte
<!-- ConfirmDialog.svelte -->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		open: boolean;
		title: string;
		description: string;
		actionLabel: string;
		actionVariant?: 'default' | 'destructive';
		onConfirm: () => Promise<void> | void;
		onCancel: () => void;
	}

	let {
		open = $bindable(),
		title,
		description,
		actionLabel,
		actionVariant = 'default',
		onConfirm,
		onCancel
	}: Props = $props();
	let isPending = $state(false);

	async function handleConfirm() {
		isPending = true;
		try {
			await onConfirm();
			open = false;
		} finally {
			isPending = false;
		}
	}
</script>
```

Note: The project page already has an `openConfirmDialog` function with this exact pattern inline. Extracting to a shared component is optional — the pattern works either way.

### Pattern 5: Auth Redirect with Message

**What:** Redirect unauthenticated users to login with a reason query param
**When to use:** When loading a project page while not authenticated
**Example:**

```typescript
// In project page onMount:
await waitForAuth();
if (!isAuthenticated()) {
	goto(`/api/auth/login?reason=auth_required`);
	return;
}
```

### Anti-Patterns to Avoid

- **Silent `void authFetch(...)`:** Many store functions fire-and-forget API calls with `void`. These silently swallow errors. Each needs a `.catch()` with `toast.error()`.
- **`console.error` as error handling:** Currently 20+ `console.error` calls serve as the only error feedback. Every one needs a corresponding toast.
- **Blocking UI on upload:** Don't await the full upload before returning control. Show progress toast and let the user continue interacting.

## Don't Hand-Roll

| Problem              | Don't Build                | Use Instead                        | Why                                                        |
| -------------------- | -------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| Toast notifications  | Custom notification system | svelte-sonner `toast.*()`          | Already installed, handles stacking, auto-dismiss, theming |
| Confirmation dialogs | Custom modal system        | shadcn Dialog                      | Already installed, accessible, handles focus trap          |
| Upload progress      | ReadableStream hacks       | XMLHttpRequest `upload.onprogress` | Only reliable browser API for upload progress              |
| Skeleton animation   | Custom CSS keyframes       | Tailwind `animate-pulse`           | Already used in project, consistent                        |

**Key insight:** The project already has all UI primitives installed. This phase is about wiring them into existing code paths, not adding new libraries.

## Common Pitfalls

### Pitfall 1: Fire-and-Forget API Calls

**What goes wrong:** Many store functions use `void authFetch(...)` which swallows errors silently. The user performs an action, it fails, and they never know.
**Why it happens:** Optimistic UI updates — the local state changes immediately, and the API call is fire-and-forget.
**How to avoid:** Add `.catch(() => toast.error(...))` to every `void authFetch(...)` call. Keep the optimistic update pattern but surface failures.
**Warning signs:** Any `void authFetch(` or `void fetch(` in the codebase.

### Pitfall 2: Toast Import Location

**What goes wrong:** Importing `toast` from `svelte-sonner` in a server-side file causes build errors.
**Why it happens:** `toast` relies on browser APIs. Store files in SvelteKit can run on both server and client.
**How to avoid:** Only call `toast.*()` in client-side code (components, or guard with `if (typeof window !== 'undefined')`). Or better: call toast from the component that triggers the store action, not from the store itself.
**Warning signs:** Build errors mentioning "window is not defined" or "document is not defined".

### Pitfall 3: XHR Doesn't Send Cookies by Default

**What goes wrong:** `XMLHttpRequest` doesn't send cookies unless `withCredentials` is set.
**Why it happens:** XHR has different defaults than `fetch` for same-origin requests.
**How to avoid:** Set `xhr.withCredentials = true` for same-origin authenticated uploads. Since all uploads go to same-origin API routes, this is needed for session cookies.
**Warning signs:** 401 errors on upload requests that work fine with `fetch`.

### Pitfall 4: Progress Toast Not Dismissing

**What goes wrong:** Using `duration: Infinity` for progress toasts but forgetting to dismiss on error.
**Why it happens:** Error path doesn't call `toast.dismiss(toastId)`.
**How to avoid:** Always dismiss the progress toast in a `finally` block, then show success or error toast.
**Warning signs:** Stuck progress toasts after upload failures.

### Pitfall 5: Skeleton Flash on Fast Loads

**What goes wrong:** Skeleton appears for a split second on fast connections, causing a flash.
**Why it happens:** Loading state is true briefly before data arrives.
**How to avoid:** This is generally acceptable. For very fast loads, the skeleton flash is barely noticeable. Don't add artificial delays — that's worse UX.
**Warning signs:** Users on fast connections complaining about flickering.

## Code Examples

### Toast Error from Store Function

```typescript
import { toast } from 'svelte-sonner';

// In component calling the store:
async function handleDelete() {
	try {
		await removeProject(id);
	} catch (err) {
		toast.error(m.error_delete_project());
	}
}
```

### Upload Progress Toast Component

```svelte
<!-- UploadProgress.svelte -->
<script lang="ts">
	let { progress = 0, filename = '' }: { progress: number; filename: string } = $props();
</script>

<div class="flex flex-col gap-2 w-full">
	<div class="flex justify-between text-sm">
		<span class="truncate max-w-[200px]">{filename}</span>
		<span>{progress}%</span>
	</div>
	<div class="h-2 bg-slate-200 rounded-full overflow-hidden">
		<div
			class="h-full bg-blue-500 rounded-full transition-all duration-300"
			style="width: {progress}%"
		></div>
	</div>
</div>
```

### Offline Badge in Header

```svelte
<script lang="ts">
	import { getPendingChanges, isOnline } from '$lib/stores/sync.svelte';
	import { Badge } from '$lib/components/ui/badge';

	const pending = $derived(getPendingChanges());
	const online = $derived(isOnline());
</script>

{#if !online && pending > 0}
	<Badge variant="secondary">{pending}</Badge>
{/if}
```

### Auth Redirect with Message

```typescript
// In project page onMount, before loading project:
await waitForAuth();
if (!isAuthenticated()) {
	// Redirect to login — authFetch already handles 401 redirect,
	// but for direct page visit we need explicit check
	goto('/?auth=required');
	return;
}
```

## Existing Code Audit

### Places Needing Toast Errors (fire-and-forget `void authFetch`)

Found in `src/lib/stores/project.svelte.ts`:

1. `createProject()` — line 743: `void authFetch('/api/projects', ...)`
2. `updateProjectName()` — line 775: `void authFetch(...)`
3. `setFloorplan()` — line 797: `void uploadFloorplan(...)`
4. `updateFloorplanScale()` — line 823: `void authFetch(...)`
5. `clearFloorplan()` — line 845: `void authFetch(...)`
6. `addItem()` — line 873: `void authFetch(...)`
7. `updateItem()` — line 909: `void authFetch(...)`
8. `deleteItem()` — line 939: `void authFetch(...)`
9. `duplicateItem()` — line 981: `void authFetch(...)`

### Places with `console.error` Only (catch blocks)

1. `listProjects()` catch — returns local data silently
2. `loadProjectById()` catch — falls back silently
3. `syncProjectToCloud()` catch — returns false silently
4. `setActiveBranch()` catch — falls back silently
5. `createProjectBranch()` catch — returns null silently
6. `renameProjectBranch()` catch — returns false silently
7. `deleteProjectBranch()` catch — returns false silently
8. `uploadItemImage()` catch — returns null silently
9. `deleteItemImage()` catch — returns false silently

### Destructive Actions Already Using Confirm Dialog

1. Home page: Delete project — uses shadcn Dialog (good)
2. Project page: Delete item — uses `openConfirmDialog` (good)
3. Project page: Delete branch — uses `openConfirmDialog` (good)
4. Project page: Change floorplan — uses `openConfirmDialog` (good)

### Destructive Actions Needing Audit

- Delete item image (in ItemForm) — currently just calls `void storeDeleteItemImage()` with no confirmation
- Clear canvas / unplace all items — check if exists
- Any other destructive actions in sidebar or settings

### Existing Skeleton States

1. Home page (`+page.svelte`): 6 skeleton cards with `animate-pulse` — already implemented
2. Project page (`+page.svelte`): Header + canvas skeleton — already implemented

### Auth Handling

- `authFetch()` in `auth.svelte.ts` already handles 401 by calling `handleUnauthorized()` which redirects to `/api/auth/login`
- No "reason" message is shown — just a redirect
- Direct page visits (e.g., `/projects/abc`) load client-side, wait for auth, then load project. If not authenticated, `loadProjectById` returns null and redirects to `/`

## State of the Art

| Old Approach       | Current Approach                | When Changed           | Impact                                      |
| ------------------ | ------------------------------- | ---------------------- | ------------------------------------------- |
| fetch for uploads  | Still fetch (no progress)       | N/A                    | Must switch to XHR for upload progress      |
| console.error only | toast.error() for user feedback | This phase             | Users see errors instead of silent failures |
| native confirm()   | shadcn Dialog                   | Already partially done | Consistent, styled, accessible dialogs      |

## Open Questions

1. **Toast position for mobile vs desktop**
   - What we know: Sonner supports `position` prop (e.g., `top-right`, `bottom-center`)
   - Recommendation: Use `bottom-right` on desktop, `top-center` on mobile (avoids overlap with bottom nav tabs). Can set via responsive detection in `+layout.svelte`.

2. **Which actions qualify as "destructive" beyond obvious deletes?**
   - Recommendation: Delete project, delete item, delete item image, delete branch, change/remove floorplan. Do NOT confirm: unplace items (reversible), rename, currency change.

3. **Toast calls: in store vs in component?**
   - What we know: Stores can run on server during SSR; `toast` needs browser.
   - Recommendation: Keep store functions returning success/failure. Call `toast` from the component that invokes the action. For fire-and-forget patterns, add `.catch()` with toast in the component layer or add a thin wrapper.

## Sources

### Primary (HIGH confidence)

- svelte-sonner README via Context7 (`/wobsoriano/svelte-sonner`) — toast API, custom components, promise toasts
- Project codebase — existing patterns in `project.svelte.ts`, `auth.svelte.ts`, `sync.svelte.ts`, `+page.svelte` (home and project)

### Secondary (MEDIUM confidence)

- MDN XMLHttpRequest `upload.onprogress` — well-established browser API, universally supported
- Tailwind `animate-pulse` — standard utility, already in use

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — patterns already established in codebase, extending not inventing
- Pitfalls: HIGH — based on direct codebase audit of existing error handling gaps

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable domain, no moving targets)
