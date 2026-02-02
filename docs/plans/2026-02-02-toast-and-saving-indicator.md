# Toast & Saving Indicator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add error toast notifications and a cloud sync status indicator next to the project name.

**Architecture:** Install Sonner for toasts. Create a sync status store to track in-flight API calls. Wrap existing `void fetch(...)` calls to track status and handle errors. Display sync status inline with project title.

**Tech Stack:** Svelte 5, shadcn-svelte (Sonner), TypeScript

---

### Task 1: Install Sonner Component

**Files:**
- Create: `src/lib/components/ui/sonner/index.ts`
- Create: `src/lib/components/ui/sonner/sonner.svelte`

**Step 1: Install sonner package**

Run: `bun add sonner`

**Step 2: Create sonner component**

Create `src/lib/components/ui/sonner/sonner.svelte`:

```svelte
<script lang="ts">
	import { Toaster as Sonner, type ToasterProps } from 'sonner';

	let props: ToasterProps = $props();
</script>

<Sonner
	class="toaster group"
	toastOptions={{
		classes: {
			toast:
				'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
			description: 'group-[.toast]:text-muted-foreground',
			actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
			cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground'
		}
	}}
	{...props}
/>
```

Create `src/lib/components/ui/sonner/index.ts`:

```typescript
export { default as Toaster } from './sonner.svelte';
```

**Step 3: Commit**

```bash
git add src/lib/components/ui/sonner
git commit -m "feat: add sonner toast component"
```

---

### Task 2: Add Toaster to Layout

**Files:**
- Modify: `src/routes/+layout.svelte`

**Step 1: Add Toaster import and component**

Add import at top of script:
```typescript
import { Toaster } from '$lib/components/ui/sonner';
```

Add `<Toaster />` inside the Tooltip.Provider, after the div:

```svelte
<Tooltip.Provider>
	<div class="h-screen bg-slate-100 flex flex-col overflow-hidden">
		{@render children()}
	</div>
	<Toaster />
</Tooltip.Provider>
```

**Step 2: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: add toaster to app layout"
```

---

### Task 3: Create Sync Status Store

**Files:**
- Modify: `src/lib/stores/project.svelte.ts`

**Step 1: Add sync status state and helpers**

Add after `let autoSaveTimeout` (around line 54):

```typescript
// Sync status tracking
let syncCount = $state(0);
let lastSyncedAt = $state<number | null>(null);

export function isSyncing(): boolean {
	return syncCount > 0;
}

export function getLastSyncedAt(): number | null {
	return lastSyncedAt;
}

async function trackedFetch(
	url: string,
	options?: RequestInit,
	errorMessage?: string
): Promise<Response> {
	syncCount++;
	try {
		const response = await fetch(url, options);
		if (!response.ok && errorMessage) {
			const { toast } = await import('sonner');
			toast.error(errorMessage);
		}
		if (response.ok) {
			lastSyncedAt = Date.now();
		}
		return response;
	} catch (error) {
		if (errorMessage) {
			const { toast } = await import('sonner');
			toast.error(errorMessage);
		}
		throw error;
	} finally {
		syncCount--;
	}
}
```

**Step 2: Commit**

```bash
git add src/lib/stores/project.svelte.ts
git commit -m "feat: add sync status tracking with error toasts"
```

---

### Task 4: Update Project Store to Use Tracked Fetch

**Files:**
- Modify: `src/lib/stores/project.svelte.ts`

**Step 1: Replace void fetch calls with trackedFetch**

Update `createProject` (around line 329):
```typescript
// Change from:
void fetch('/api/projects', { ... });
// To:
void trackedFetch('/api/projects', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		id: currentProject.id,
		name: currentProject.name,
		currency: currentProject.currency,
		gridSize: currentProject.gridSize
	})
}, 'Failed to save project');
```

Update `updateProjectName` (around line 362):
```typescript
void trackedFetch(`/api/projects/${currentProject.id}`, {
	method: 'PATCH',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ name })
}, 'Failed to save changes');
```

Update `setFloorplan` - replace `void uploadFloorplan(...)` with tracked version (around line 383):
```typescript
void (async () => {
	syncCount++;
	try {
		await uploadFloorplan(currentProject.id, floorplan);
		lastSyncedAt = Date.now();
	} catch {
		const { toast } = await import('sonner');
		toast.error('Failed to upload floorplan');
	} finally {
		syncCount--;
	}
})();
```

Update `clearFloorplan` (around line 406):
```typescript
void trackedFetch(`/api/projects/${currentProject.id}/floorplan`, {
	method: 'DELETE'
}, 'Failed to save changes');
```

Update `addItem` (around line 429):
```typescript
void trackedFetch(`/api/projects/${currentProject.id}/items`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(buildItemPayload(newItem))
}, 'Failed to save item');
```

Update `updateItem` (around line 459):
```typescript
void trackedFetch(`/api/projects/${currentProject.id}/items/${id}`, {
	method: 'PATCH',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(buildItemPayload(updatedItem))
}, 'Failed to save item');
```

Update `deleteItem` (around line 481):
```typescript
void trackedFetch(`/api/projects/${currentProject.id}/items/${id}`, {
	method: 'DELETE'
}, 'Failed to save changes');
```

Update `duplicateItem` (around line 519):
```typescript
void trackedFetch(`/api/projects/${currentProject.id}/items`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(buildItemPayload(newItem))
}, 'Failed to save item');
```

Update `setCurrency` (around line 568):
```typescript
void trackedFetch(`/api/projects/${currentProject.id}`, {
	method: 'PATCH',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ currency })
}, 'Failed to save changes');
```

Update `setGridSize` (around line 594):
```typescript
void trackedFetch(`/api/projects/${currentProject.id}`, {
	method: 'PATCH',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ gridSize: currentProject.gridSize })
}, 'Failed to save changes');
```

**Step 2: Commit**

```bash
git add src/lib/stores/project.svelte.ts
git commit -m "feat: use tracked fetch for all cloud sync operations"
```

---

### Task 5: Add Saving Indicator to Project Header

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte`

**Step 1: Import sync status functions**

Add to imports (around line 32):
```typescript
import { isSyncing, getLastSyncedAt } from '$lib/stores/project.svelte';
```

**Step 2: Add sync status derived state**

Add after `const gridSize = $derived(getGridSize());` (around line 86):
```typescript
// Sync status
const syncing = $derived(isSyncing());
const lastSynced = $derived(getLastSyncedAt());

// Show "Saved" for 2 seconds after sync completes
let showSaved = $state(false);
let savedTimeout: ReturnType<typeof setTimeout> | null = null;

$effect(() => {
	if (lastSynced && !syncing) {
		showSaved = true;
		if (savedTimeout) clearTimeout(savedTimeout);
		savedTimeout = setTimeout(() => {
			showSaved = false;
		}, 2000);
	}
});
```

**Step 3: Add indicator to header**

After the project name button (around line 331), add the sync indicator:
```svelte
{#if !isLocalProject && authed}
	{#if syncing}
		<span class="text-slate-400 text-sm ml-1">· Saving...</span>
	{:else if showSaved}
		<span class="text-slate-400 text-sm ml-1">· Saved</span>
	{/if}
{/if}
```

The full header section should look like:
```svelte
{#if isEditingName}
	<Input
		bind:ref={nameInputEl}
		bind:value={editNameValue}
		onblur={commitNameEdit}
		onkeydown={handleNameKeydown}
		class="w-auto max-w-64 text-lg font-semibold"
	/>
{:else}
	<Button
		variant="ghost"
		onclick={startEditingName}
		class="text-lg font-semibold text-slate-800 hover:text-slate-600"
	>
		{project.name}
	</Button>
{/if}
{#if !isLocalProject && authed}
	{#if syncing}
		<span class="text-slate-400 text-sm ml-1">· Saving...</span>
	{:else if showSaved}
		<span class="text-slate-400 text-sm ml-1">· Saved</span>
	{/if}
{/if}
```

**Step 4: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "feat: add saving indicator next to project name"
```

---

### Task 6: Add Error Toasts to Share Dialog

**Files:**
- Modify: `src/lib/components/sharing/ShareDialog.svelte`

**Step 1: Import toast**

Add to imports:
```typescript
import { toast } from 'sonner';
```

**Step 2: Update loadMembers error handling**

Replace the catch block in `loadMembers`:
```typescript
} catch (err) {
	toast.error('Failed to load members');
	errorMessage = 'Failed to load members';
}
```

**Step 3: Update handleInvite error handling**

Replace the throw in `handleInvite`:
```typescript
if (!response.ok) {
	toast.error('Failed to send invite');
	throw new Error('Invite failed');
}
```

**Step 4: Update handleRoleChange error handling**

Add error handling:
```typescript
async function handleRoleChange(userId: string, role: ProjectRole) {
	const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ role })
	});
	if (response.ok) {
		await loadMembers();
	} else {
		toast.error('Failed to update role');
	}
}
```

**Step 5: Update handleRemove error handling**

Add error handling:
```typescript
async function handleRemove(userId: string) {
	if (!confirm('Remove this member?')) return;
	const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
		method: 'DELETE'
	});
	if (response.ok) {
		await loadMembers();
	} else {
		toast.error('Failed to remove member');
	}
}
```

**Step 6: Commit**

```bash
git add src/lib/components/sharing/ShareDialog.svelte
git commit -m "feat: add error toasts to share dialog"
```

---

### Task 7: Add Error Toast to Invite Form

**Files:**
- Modify: `src/lib/components/sharing/InviteForm.svelte`

**Step 1: Import toast**

Add to imports:
```typescript
import { toast } from 'sonner';
```

**Step 2: Update error handling in handleInvite**

Replace the catch block:
```typescript
} catch (err) {
	toast.error('Failed to send invite');
}
```

**Step 3: Commit**

```bash
git add src/lib/components/sharing/InviteForm.svelte
git commit -m "feat: add error toast to invite form"
```

---

### Task 8: Final Verification

**Step 1: Type check**

Run: `bun check`

Expected: No type errors

**Step 2: Build check**

Run: `bun build`

Expected: Build succeeds

**Step 3: Manual testing**

1. Open a cloud-synced project (authenticated)
2. Edit the project name - should see "Saving..." then "Saved"
3. Add/move an item - should see "Saving..." then "Saved"
4. Disconnect network and try an action - should see error toast
5. Open Share dialog and test invite flow

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from verification"
```
