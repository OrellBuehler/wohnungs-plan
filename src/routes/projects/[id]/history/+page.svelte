<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { ItemChange } from '$lib/types';
	import {
		FlexRender,
		createSvelteTable,
		renderComponent,
		renderSnippet
	} from '$lib/components/ui/data-table';
	import {
		type ColumnDef,
		type PaginationState,
		type RowSelectionState,
		getCoreRowModel,
		getPaginationRowModel
	} from '@tanstack/table-core';
	import { createRawSnippet } from 'svelte';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ArrowLeft, RotateCcw } from 'lucide-svelte';
	import HistoryActionBadge from '$lib/components/projects/HistoryActionBadge.svelte';
	import {
		getProject,
		getItems,
		getItemHistory,
		revertHistoryChanges
	} from '$lib/stores/project.svelte';

	const projectId = $derived($page.params.id);
	const project = $derived(getProject());
	const items = $derived(getItems());

	let changes = $state<ItemChange[]>([]);
	let loading = $state(true);

	// Filters
	let filterItem = $state('');
	let filterUser = $state('');

	// Derive unique item names and users for filter dropdowns
	const itemOptions = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const c of changes) {
			const item = items.find((i) => i.id === c.itemId);
			if (item && !seen.has(c.itemId)) {
				seen.set(c.itemId, item.name);
			}
		}
		return [...seen.entries()].map(([id, name]) => ({ value: id, label: name }));
	});

	const userOptions = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const c of changes) {
			const key = c.userId ?? '__anonymous';
			if (!seen.has(key)) {
				seen.set(key, c.userName ?? 'Unknown');
			}
		}
		return [...seen.entries()].map(([id, name]) => ({ value: id, label: name }));
	});

	const filterItemLabel = $derived(
		filterItem ? (itemOptions.find((o) => o.value === filterItem)?.label ?? 'All items') : 'All items'
	);
	const filterUserLabel = $derived(
		filterUser ? (userOptions.find((o) => o.value === filterUser)?.label ?? 'All users') : 'All users'
	);

	// Grouping: changes within 2s by same user on same item
	function computeGroups(data: ItemChange[]): Set<string> {
		const groupStarts = new Set<string>();
		for (let i = 0; i < data.length; i++) {
			const curr = data[i];
			const prev = data[i - 1];
			if (
				!prev ||
				prev.userId !== curr.userId ||
				prev.itemId !== curr.itemId ||
				Math.abs(new Date(prev.createdAt).getTime() - new Date(curr.createdAt).getTime()) > 2000
			) {
				groupStarts.add(curr.id);
			}
		}
		return groupStarts;
	}

	// Filtered data
	const filteredData = $derived.by(() => {
		let result = changes;
		if (filterItem) {
			result = result.filter((c) => c.itemId === filterItem);
		}
		if (filterUser) {
			const userId = filterUser === '__anonymous' ? null : filterUser;
			result = result.filter((c) => c.userId === userId);
		}
		return result;
	});

	const groupStarts = $derived(computeGroups(filteredData));

	// Relative time helper
	function relativeTime(dateStr: string): string {
		const now = Date.now();
		const then = new Date(dateStr).getTime();
		const diffSec = Math.floor((now - then) / 1000);
		if (diffSec < 60) return `${diffSec}s ago`;
		const diffMin = Math.floor(diffSec / 60);
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `${diffHr}h ago`;
		const diffDay = Math.floor(diffHr / 24);
		return `${diffDay}d ago`;
	}

	function resolveItemName(itemId: string): string {
		return items.find((i) => i.id === itemId)?.name ?? 'Deleted item';
	}

	// Pagination
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 20 });
	let rowSelection = $state<RowSelectionState>({});

	const selectedCount = $derived(Object.keys(rowSelection).length);

	// Column definitions
	const columns: ColumnDef<ItemChange>[] = [
		{
			id: 'select',
			header: ({ table }) =>
				renderComponent(Checkbox, {
					checked: table.getIsAllPageRowsSelected(),
					indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
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
				const value = row.original.createdAt;
				const isStart = groupStarts.has(row.original.id);
				return renderSnippet(
					createRawSnippet(() => ({
						render: () =>
							`<span class="${isStart ? '' : 'text-muted-foreground'}" title="${new Date(value).toLocaleString()}">${relativeTime(value)}</span>`
					})),
					undefined as never
				);
			}
		},
		{
			accessorKey: 'userName',
			header: 'User',
			cell: ({ row }) => {
				const value = row.original.userName ?? 'Unknown';
				const isStart = groupStarts.has(row.original.id);
				return renderSnippet(
					createRawSnippet(() => ({
						render: () =>
							`<span class="${isStart ? '' : 'text-muted-foreground'}">${value}</span>`
					})),
					undefined as never
				);
			}
		},
		{
			id: 'item',
			header: 'Item',
			cell: ({ row }) => {
				const name = resolveItemName(row.original.itemId);
				const isStart = groupStarts.has(row.original.id);
				return renderSnippet(
					createRawSnippet(() => ({
						render: () =>
							`<span class="${isStart ? '' : 'text-muted-foreground'}">${name}</span>`
					})),
					undefined as never
				);
			}
		},
		{
			accessorKey: 'action',
			header: 'Action',
			cell: ({ row }) =>
				renderComponent(HistoryActionBadge, { action: row.original.action })
		},
		{
			accessorKey: 'field',
			header: 'Field',
			cell: ({ row }) => {
				const value = row.original.field;
				return renderSnippet(
					createRawSnippet(() => ({
						render: () => `<span>${value ?? '\u2014'}</span>`
					})),
					undefined as never
				);
			}
		},
		{
			id: 'change',
			header: 'Change',
			cell: ({ row }) => {
				const { action, oldValue, newValue } = row.original;
				if (action !== 'update') {
					return renderSnippet(
						createRawSnippet(() => ({
							render: () => `<span class="text-muted-foreground">\u2014</span>`
						})),
						undefined as never
					);
				}
				return renderSnippet(
					createRawSnippet(() => ({
						render: () =>
							`<span><span class="line-through text-muted-foreground">${oldValue ?? ''}</span> <span class="font-medium">${newValue ?? ''}</span></span>`
					})),
					undefined as never
				);
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
		onRowSelectionChange(updater) {
			if (typeof updater === 'function') {
				rowSelection = updater(rowSelection);
			} else {
				rowSelection = updater;
			}
		},
		onPaginationChange(updater) {
			if (typeof updater === 'function') {
				pagination = updater(pagination);
			} else {
				pagination = updater;
			}
		},
		state: {
			get rowSelection() {
				return rowSelection;
			},
			get pagination() {
				return pagination;
			}
		}
	});

	async function handleRevert() {
		const selectedRows = table.getSelectedRowModel().rows;
		const ids = selectedRows.map((r) => r.original.id);
		if (ids.length === 0) return;

		const success = await revertHistoryChanges(ids);
		if (success) {
			rowSelection = {};
			changes = await getItemHistory(200, 0);
		}
	}

	onMount(async () => {
		if (!project) {
			goto(`/projects/${projectId}`);
			return;
		}
		changes = await getItemHistory(200, 0);
		loading = false;
	});
</script>

<div class="flex flex-col h-full min-h-0">
	<!-- Header -->
	<div class="flex-shrink-0 border-b px-4 py-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<Button variant="ghost" size="icon" onclick={() => goto(`/projects/${projectId}`)}>
					<ArrowLeft size={20} />
				</Button>
				<div>
					<h1 class="text-lg font-semibold">Change History</h1>
					{#if project}
						<p class="text-sm text-muted-foreground">{project.name}</p>
					{/if}
				</div>
			</div>
			<Button
				variant="outline"
				size="sm"
				disabled={selectedCount === 0}
				onclick={handleRevert}
			>
				<RotateCcw size={14} class="mr-1" />
				Revert ({selectedCount})
			</Button>
		</div>
	</div>

	<!-- Filter toolbar -->
	<div class="flex-shrink-0 px-4 py-2 flex gap-2">
		<Select.Root
			type="single"
			value={filterItem}
			onValueChange={(v) => {
				filterItem = v ?? '';
				rowSelection = {};
			}}
		>
			<Select.Trigger class="w-[180px] h-8">
				{filterItemLabel}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All items</Select.Item>
				{#each itemOptions as opt (opt.value)}
					<Select.Item value={opt.value}>{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root
			type="single"
			value={filterUser}
			onValueChange={(v) => {
				filterUser = v ?? '';
				rowSelection = {};
			}}
		>
			<Select.Trigger class="w-[160px] h-8">
				{filterUserLabel}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All users</Select.Item>
				{#each userOptions as opt (opt.value)}
					<Select.Item value={opt.value}>{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<!-- Data table -->
	<div class="flex-1 min-h-0 overflow-auto px-4">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<p class="text-muted-foreground">Loading history...</p>
			</div>
		{:else if filteredData.length === 0}
			<div class="flex items-center justify-center py-12">
				<p class="text-muted-foreground">
					{changes.length === 0 ? 'No change history yet.' : 'No changes match the current filters.'}
				</p>
			</div>
		{:else}
			<Table.Root>
				<Table.Header>
					{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
						<Table.Row>
							{#each headerGroup.headers as header (header.id)}
								<Table.Head>
									{#if !header.isPlaceholder}
										<FlexRender
											content={header.column.columnDef.header}
											context={header.getContext()}
										/>
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					{/each}
				</Table.Header>
				<Table.Body>
					{#each table.getRowModel().rows as row (row.id)}
						{@const isStart = groupStarts.has(row.original.id)}
						<Table.Row class={isStart ? '' : 'border-t-0'}>
							{#each row.getVisibleCells() as cell (cell.id)}
								<Table.Cell>
									<FlexRender
										content={cell.column.columnDef.cell}
										context={cell.getContext()}
									/>
								</Table.Cell>
							{/each}
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</div>

	<!-- Pagination -->
	<div class="flex-shrink-0 border-t px-4 py-3 flex items-center justify-between">
		<p class="text-sm text-muted-foreground">
			{selectedCount} of {table.getFilteredRowModel().rows.length} row(s) selected
		</p>
		<div class="flex gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={!table.getCanPreviousPage()}
				onclick={() => table.previousPage()}
			>
				Previous
			</Button>
			<Button
				variant="outline"
				size="sm"
				disabled={!table.getCanNextPage()}
				onclick={() => table.nextPage()}
			>
				Next
			</Button>
		</div>
	</div>
</div>
