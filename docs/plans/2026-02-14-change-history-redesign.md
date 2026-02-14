# Change History Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the modal-based change history with a full-page TanStack Data Table at `/projects/[id]/history`, hidden on mobile.

**Architecture:** New SvelteKit route with SSR data loading. Uses shadcn-svelte `table` + `data-table` components powered by `@tanstack/table-core`. Reuses existing API endpoints and store functions unchanged.

**Tech Stack:** SvelteKit, Svelte 5 runes, shadcn-svelte (table, data-table, select, checkbox, button, badge, tooltip), @tanstack/table-core, lucide-svelte

---

### Task 1: Install dependencies

**Step 1: Install shadcn table and data-table components**

Run: `bunx shadcn-svelte@latest add table`

Expected: Creates files in `src/lib/components/ui/table/` and `src/lib/components/ui/data-table/`

**Step 2: Install badge component (for action column)**

Run: `bunx shadcn-svelte@latest add badge`

Expected: Creates files in `src/lib/components/ui/badge/`

**Step 3: Install tooltip component (for timestamp hover)**

Run: `bunx shadcn-svelte@latest add tooltip`

Expected: Creates files in `src/lib/components/ui/tooltip/`

**Step 4: Install TanStack table-core**

Run: `bun add @tanstack/table-core`

**Step 5: Verify type-check passes**

Run: `bun check`
Expected: No errors

**Step 6: Commit**

```bash
git add -A && git commit -m "feat(deps): add shadcn table, badge, tooltip and @tanstack/table-core"
```

---

### Task 2: Create history page server loader

**Files:**
- Create: `src/routes/projects/[id]/history/+page.server.ts`

**Step 1: Write the server load function**

This loads the project (for the name/metadata), the branch's item list (for resolving item names), and the initial history page. Pattern follows existing `src/routes/projects/[id]/+page.server.ts`.

```typescript
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProjectById, getProjectRole } from '$lib/server/projects';
import { getBranchById, getDefaultBranch } from '$lib/server/branches';
import { listItems, listItemChanges } from '$lib/server/items';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const project = await getProjectById(params.id);
	if (!project) {
		throw error(404, 'Project not found');
	}

	const branchId = url.searchParams.get('branch');
	const branch = branchId
		? await getBranchById(params.id, branchId)
		: await getDefaultBranch(params.id);

	if (!branch) {
		throw error(404, 'Branch not found');
	}

	const [items, changes] = await Promise.all([
		listItems(params.id, branch.id),
		listItemChanges(params.id, branch.id, 200, 0)
	]);

	return {
		project: { id: project.id, name: project.name },
		branchId: branch.id,
		items: items.map((item) => ({ id: item.id, name: item.name })),
		changes
	};
};
```

**Step 2: Verify imports exist**

Check that `getProjectById`, `getProjectRole`, `getBranchById`, `getDefaultBranch`, `listItems`, `listItemChanges` all exist and are exported. Key files:
- `src/lib/server/projects.ts` — `getProjectById`, `getProjectRole`
- `src/lib/server/branches.ts` — `getBranchById`, `getDefaultBranch`
- `src/lib/server/items.ts` — `listItems`, `listItemChanges`

If `getDefaultBranch` doesn't exist, look for the equivalent function (may be named differently) and adjust the import.

**Step 3: Type-check**

Run: `bun check`
Expected: PASS (the page component doesn't exist yet, but the loader should compile)

**Step 4: Commit**

```bash
git add src/routes/projects/\[id\]/history/+page.server.ts
git commit -m "feat(history): add server loader for history page"
```

---

### Task 3: Create history page with data table

**Files:**
- Create: `src/routes/projects/[id]/history/+page.svelte`

**Step 1: Create the full page component**

This is the main component. It uses TanStack table with shadcn-svelte's data-table rendering utilities. Key behaviors:
- Columns: checkbox, timestamp, user, item, action (badge), field, old→new value
- Filtering: Select dropdowns for item and user above table
- Pagination: Previous/Next at bottom
- Row selection: checkbox column, "Revert Selected" button in header
- Visual grouping: rows in same group (same user+item within 2s) get muted repeated cells

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		type ColumnDef,
		type PaginationState,
		type ColumnFiltersState,
		type RowSelectionState,
		getCoreRowModel,
		getPaginationRowModel,
		getFilteredRowModel
	} from '@tanstack/table-core';
	import { createRawSnippet } from 'svelte';
	import {
		FlexRender,
		createSvelteTable,
		renderComponent,
		renderSnippet
	} from '$lib/components/ui/data-table';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { ArrowLeft, RotateCcw } from 'lucide-svelte';
	import { revertHistoryChanges, getItemHistory } from '$lib/stores/project.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	interface HistoryRow {
		id: string;
		createdAt: string;
		userName: string | null;
		userId: string | null;
		itemId: string;
		itemName: string;
		action: 'create' | 'update' | 'delete';
		field: string | null;
		oldValue: string | null;
		newValue: string | null;
		groupId: string;
		isGroupStart: boolean;
	}

	// Build item name lookup
	const itemNameMap = $derived(
		new Map(data.items.map((item) => [item.id, item.name]))
	);

	// Assign group IDs for visual grouping
	function buildRows(changes: typeof data.changes): HistoryRow[] {
		const sorted = [...changes].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);

		const rows: HistoryRow[] = [];
		let currentGroupId = '';
		let groupIndex = 0;

		for (let i = 0; i < sorted.length; i++) {
			const change = sorted[i];
			const prev = i > 0 ? sorted[i - 1] : null;

			const sameUser = prev && prev.userId === change.userId;
			const sameItem = prev && prev.itemId === change.itemId;
			const withinWindow =
				prev &&
				Math.abs(
					new Date(prev.createdAt).getTime() - new Date(change.createdAt).getTime()
				) <= 2000;

			const isGroupStart = !prev || !sameUser || !sameItem || !withinWindow;
			if (isGroupStart) {
				groupIndex++;
				currentGroupId = `group-${groupIndex}`;
			}

			rows.push({
				id: change.id,
				createdAt: change.createdAt,
				userName: change.userName ?? null,
				userId: change.userId ?? null,
				itemId: change.itemId,
				itemName: itemNameMap.get(change.itemId) ?? `Item ${change.itemId.slice(0, 8)}`,
				action: change.action as 'create' | 'update' | 'delete',
				field: change.field ?? null,
				oldValue: change.oldValue ?? null,
				newValue: change.newValue ?? null,
				groupId: currentGroupId,
				isGroupStart
			});
		}

		return rows;
	}

	let tableData = $state(buildRows(data.changes));

	// Unique users and items for filters
	const uniqueUsers = $derived(
		[...new Map(tableData.filter((r) => r.userName).map((r) => [r.userId, r.userName])).entries()].map(
			([id, name]) => ({ value: id!, label: name! })
		)
	);
	const uniqueItems = $derived(
		[...new Map(tableData.map((r) => [r.itemId, r.itemName])).entries()].map(
			([id, name]) => ({ value: id, label: name })
		)
	);

	// Filter state
	let selectedUser = $state<string>('');
	let selectedItem = $state<string>('');

	const filteredData = $derived(
		tableData.filter((row) => {
			if (selectedUser && row.userId !== selectedUser) return false;
			if (selectedItem && row.itemId !== selectedItem) return false;
			return true;
		})
	);

	// Table state
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 50 });
	let rowSelection = $state<RowSelectionState>({});

	const columns: ColumnDef<HistoryRow>[] = [
		{
			id: 'select',
			header: ({ table }) =>
				renderComponent(Checkbox, {
					checked: table.getIsAllPageRowsSelected(),
					indeterminate:
						table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
					onCheckedChange: (value: boolean) => table.toggleAllPageRowsSelected(!!value),
					'aria-label': 'Select all'
				}),
			cell: ({ row }) =>
				renderComponent(Checkbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (value: boolean) => row.toggleSelected(!!value),
					'aria-label': 'Select row'
				}),
			enableSorting: false,
			enableHiding: false
		},
		{
			accessorKey: 'createdAt',
			header: 'Time',
			cell: ({ row }) => {
				const snippet = createRawSnippet<[string]>((getVal) => {
					const val = getVal();
					const date = new Date(val);
					const relative = formatRelativeTime(date);
					const absolute = date.toLocaleString();
					return {
						render: () =>
							row.original.isGroupStart
								? `<span title="${absolute}" class="text-sm">${relative}</span>`
								: `<span title="${absolute}" class="text-xs text-muted-foreground">${relative}</span>`
					};
				});
				return renderSnippet(snippet, row.getValue('createdAt'));
			}
		},
		{
			accessorKey: 'userName',
			header: 'User',
			cell: ({ row }) => {
				const snippet = createRawSnippet<[string | null]>((getVal) => {
					const val = getVal() ?? 'Unknown';
					return {
						render: () =>
							row.original.isGroupStart
								? `<span class="text-sm">${val}</span>`
								: `<span class="text-xs text-muted-foreground">${val}</span>`
					};
				});
				return renderSnippet(snippet, row.getValue('userName'));
			}
		},
		{
			accessorKey: 'itemName',
			header: 'Item',
			cell: ({ row }) => {
				const snippet = createRawSnippet<[string]>((getVal) => {
					const val = getVal();
					return {
						render: () =>
							row.original.isGroupStart
								? `<span class="text-sm font-medium">${val}</span>`
								: `<span class="text-xs text-muted-foreground">${val}</span>`
					};
				});
				return renderSnippet(snippet, row.getValue('itemName'));
			}
		},
		{
			accessorKey: 'action',
			header: 'Action',
			cell: ({ row }) => {
				const action = row.getValue('action') as string;
				const variant =
					action === 'create' ? 'default' : action === 'delete' ? 'destructive' : 'secondary';
				return renderComponent(Badge, { variant, children: createRawSnippet(() => ({ render: () => action })) });
			}
		},
		{
			accessorKey: 'field',
			header: 'Field',
			cell: ({ row }) => {
				const snippet = createRawSnippet<[string | null]>((getVal) => {
					const val = getVal();
					return { render: () => (val ? `<span class="text-sm">${val}</span>` : '—') };
				});
				return renderSnippet(snippet, row.getValue('field'));
			}
		},
		{
			id: 'change',
			header: 'Change',
			cell: ({ row }) => {
				const snippet = createRawSnippet(() => {
					const { oldValue, newValue, action } = row.original;
					if (action === 'create' || action === 'delete') return { render: () => '—' };
					const old = oldValue ?? '(empty)';
					const next = newValue ?? '(empty)';
					return {
						render: () =>
							`<span class="text-sm"><span class="text-muted-foreground line-through">${old}</span> → <span class="font-medium">${next}</span></span>`
					};
				});
				return renderSnippet(snippet);
			}
		}
	];

	const table = createSvelteTable({
		get data() {
			return filteredData;
		},
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onPaginationChange: (updater) => {
			pagination = typeof updater === 'function' ? updater(pagination) : updater;
		},
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		state: {
			get pagination() {
				return pagination;
			},
			get rowSelection() {
				return rowSelection;
			}
		}
	});

	function formatRelativeTime(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHours = Math.floor(diffMin / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	const selectedCount = $derived(Object.keys(rowSelection).length);

	let isReverting = $state(false);

	async function handleRevert() {
		const selectedRows = table.getSelectedRowModel().rows;
		const changeIds = selectedRows.map((row) => row.original.id);
		if (changeIds.length === 0) return;

		isReverting = true;
		try {
			const success = await revertHistoryChanges(changeIds);
			if (success) {
				const freshChanges = await getItemHistory(200, 0);
				tableData = buildRows(freshChanges);
				rowSelection = {};
			}
		} finally {
			isReverting = false;
		}
	}
</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="border-b bg-background px-4 py-3">
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<div class="flex items-center gap-3">
				<Button variant="ghost" size="icon" onclick={() => goto(`/projects/${$page.params.id}`)}>
					<ArrowLeft size={20} />
					<span class="sr-only">Back to project</span>
				</Button>
				<div>
					<h1 class="text-lg font-semibold">Change History</h1>
					<p class="text-sm text-muted-foreground">{data.project.name}</p>
				</div>
			</div>
			<Button
				variant="default"
				size="sm"
				disabled={selectedCount === 0 || isReverting}
				onclick={handleRevert}
			>
				<RotateCcw size={16} class="mr-1.5" />
				Revert {selectedCount > 0 ? `(${selectedCount})` : ''}
			</Button>
		</div>
	</header>

	<!-- Filters -->
	<div class="mx-auto w-full max-w-6xl px-4 py-3">
		<div class="flex items-center gap-3">
			<Select.Root type="single" onValueChange={(v) => { selectedItem = v ?? ''; pagination.pageIndex = 0; }}>
				<Select.Trigger class="w-[200px]">
					{selectedItem ? uniqueItems.find((i) => i.value === selectedItem)?.label ?? 'All items' : 'All items'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">All items</Select.Item>
					{#each uniqueItems as item}
						<Select.Item value={item.value}>{item.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root type="single" onValueChange={(v) => { selectedUser = v ?? ''; pagination.pageIndex = 0; }}>
				<Select.Trigger class="w-[200px]">
					{selectedUser ? uniqueUsers.find((u) => u.value === selectedUser)?.label ?? 'All users' : 'All users'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">All users</Select.Item>
					{#each uniqueUsers as user}
						<Select.Item value={user.value}>{user.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	<!-- Data Table -->
	<div class="mx-auto w-full max-w-6xl flex-1 px-4">
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					{#each table.getHeaderGroups() as headerGroup}
						<Table.Row>
							{#each headerGroup.headers as header}
								<Table.Head>
									{#if !header.isPlaceholder}
										<FlexRender content={header.column.columnDef.header} context={header.getContext()} />
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					{/each}
				</Table.Header>
				<Table.Body>
					{#if table.getRowModel().rows?.length}
						{#each table.getRowModel().rows as row}
							<Table.Row
								data-state={row.getIsSelected() && 'selected'}
								class={row.original.isGroupStart ? '' : 'border-t-0'}
							>
								{#each row.getVisibleCells() as cell}
									<Table.Cell>
										<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{:else}
						<Table.Row>
							<Table.Cell colspan={columns.length} class="h-24 text-center">
								No history entries.
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</div>

		<!-- Pagination -->
		<div class="flex items-center justify-between py-4">
			<p class="text-sm text-muted-foreground">
				{table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected
			</p>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
				>
					Next
				</Button>
			</div>
		</div>
	</div>
</div>
```

**Note on Badge rendering:** The Badge component may need a slightly different approach for rendering children in shadcn-svelte. If `createRawSnippet` for children doesn't work with Badge, use a small helper component like `data-table-action-badge.svelte` that accepts `action` as a prop.

**Step 2: Type-check**

Run: `bun check`
Expected: PASS (may need minor adjustments to imports)

**Step 3: Commit**

```bash
git add src/routes/projects/\[id\]/history/
git commit -m "feat(history): add full-page history route with data table"
```

---

### Task 4: Update project page — link to history route, remove dialog

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte`
- Delete: `src/lib/components/projects/HistoryDialog.svelte`

**Step 1: Replace history dialog with link navigation**

In `src/routes/projects/[id]/+page.svelte`:

1. Remove imports:
   - Delete `import HistoryDialog from '$lib/components/projects/HistoryDialog.svelte';`
   - Remove `getItemHistory` and `revertHistoryChanges` from the store imports
   - Remove `History` from lucide-svelte imports? No — still used for icon. Keep it.

2. Remove state variables:
   - Delete `let showHistory = $state(false);`
   - Delete `let historyDialogRef = $state<ReturnType<typeof HistoryDialog> | null>(null);`

3. Replace `handleOpenHistory` function (around line 330):
   ```typescript
   function handleOpenHistory() {
       goto(`/projects/${projectId}/history`);
   }
   ```
   (The `goto` import already exists at the top of the file)

4. Remove the `<HistoryDialog>` component instance (around line 1166-1172):
   Delete the entire block:
   ```svelte
   <HistoryDialog
       bind:this={historyDialogRef}
       bind:open={showHistory}
       {items}
       onLoadHistory={getItemHistory}
       onRevertChanges={revertHistoryChanges}
   />
   ```

5. Hide history from mobile overflow menu. Find the mobile `DropdownMenu.Item` for History (around line 1019-1021) and wrap it or remove it:
   ```svelte
   <!-- Remove this block entirely: -->
   <DropdownMenu.Item onclick={handleOpenHistory}>
       <History size={14} class="mr-2" />
       History
   </DropdownMenu.Item>
   ```

6. In the sidebar actions `$effect` (around line 443-447), remove the History action from the `collaborationActions` array so it doesn't show in the sidebar on mobile either.

**Step 2: Delete HistoryDialog.svelte**

```bash
rm src/lib/components/projects/HistoryDialog.svelte
```

**Step 3: Check for other references to HistoryDialog**

Run: `grep -r "HistoryDialog" src/` — should return nothing.

**Step 4: Type-check**

Run: `bun check`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(history): replace dialog with route link, hide on mobile"
```

---

### Task 5: Manual testing & polish

**Step 1: Start dev server**

Run: `bun dev`

**Step 2: Test desktop flow**

1. Open a synced project in the browser
2. Click "History" button in toolbar → should navigate to `/projects/[id]/history`
3. Verify table loads with change data
4. Test filtering by item and by user
5. Test pagination (Previous/Next)
6. Select some rows via checkboxes, verify "Revert (N)" button updates
7. Click "Revert" and verify changes are applied and table refreshes
8. Click back arrow → returns to project canvas

**Step 3: Test mobile flow**

1. Open browser DevTools, toggle mobile viewport (<768px)
2. Verify "History" does NOT appear in the overflow dropdown menu
3. Verify "History" does NOT appear in sidebar actions
4. Navigate directly to `/projects/[id]/history` — this is OK, the page should still work if someone navigates there directly (no need to block it, just don't link to it)

**Step 4: Fix any issues found during testing**

Address visual glitches, import errors, or API mismatches.

**Step 5: Type-check one final time**

Run: `bun check`
Expected: PASS

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(history): polish history page after testing"
```
