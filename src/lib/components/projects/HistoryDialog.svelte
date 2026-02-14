<script lang="ts">
	import type { Item, ItemChange } from '$lib/types';
	import { Button } from '$lib/components/ui/button';

	interface HistoryGroup {
		id: string;
		userId: string | null;
		userName: string;
		itemId: string;
		createdAt: string;
		changes: ItemChange[];
	}

	let {
		open = $bindable(false),
		items,
		onLoadHistory,
		onRevertChanges
	}: {
		open: boolean;
		items: Item[];
		onLoadHistory: (limit: number, offset: number) => Promise<ItemChange[]>;
		onRevertChanges: (changeIds: string[]) => Promise<boolean>;
	} = $props();

	let isLoading = $state(false);
	let isReverting = $state(false);
	let historyChanges = $state<ItemChange[]>([]);
	let expandedGroups = $state<Set<string>>(new Set());
	let selectedChangeIds = $state<Set<string>>(new Set());

	const historyGroups = $derived(groupHistoryEntries(historyChanges));

	function groupHistoryEntries(changes: ItemChange[]): HistoryGroup[] {
		if (changes.length === 0) return [];
		const sorted = [...changes].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);

		const groups: HistoryGroup[] = [];
		for (const change of sorted) {
			const currentTime = new Date(change.createdAt).getTime();
			const last = groups[groups.length - 1];
			const lastTime = last ? new Date(last.createdAt).getTime() : 0;
			const sameActor = last?.userId === change.userId;
			const sameItem = last?.itemId === change.itemId;
			const withinWindow = Math.abs(lastTime - currentTime) <= 2000;

			if (last && sameActor && sameItem && withinWindow) {
				last.changes.push(change);
				continue;
			}

			groups.push({
				id: `${change.userId ?? 'anonymous'}:${change.itemId}:${change.createdAt}`,
				userId: change.userId,
				userName: change.userName ?? 'Unknown user',
				itemId: change.itemId,
				createdAt: change.createdAt,
				changes: [change]
			});
		}

		return groups;
	}

	function isGroupExpanded(groupId: string): boolean {
		return expandedGroups.has(groupId);
	}

	function toggleGroup(groupId: string): void {
		const next = new Set(expandedGroups);
		if (next.has(groupId)) {
			next.delete(groupId);
		} else {
			next.add(groupId);
		}
		expandedGroups = next;
	}

	function isChangeSelected(changeId: string): boolean {
		return selectedChangeIds.has(changeId);
	}

	function toggleChangeSelection(changeId: string): void {
		const next = new Set(selectedChangeIds);
		if (next.has(changeId)) {
			next.delete(changeId);
		} else {
			next.add(changeId);
		}
		selectedChangeIds = next;
	}

	function toggleGroupSelection(group: HistoryGroup): void {
		const next = new Set(selectedChangeIds);
		const hasAll = group.changes.every((change) => next.has(change.id));
		for (const change of group.changes) {
			if (hasAll) {
				next.delete(change.id);
			} else {
				next.add(change.id);
			}
		}
		selectedChangeIds = next;
	}

	function getItemLabel(itemId: string): string {
		const item = items.find((candidate) => candidate.id === itemId);
		return item?.name ?? `Item ${itemId.slice(0, 8)}`;
	}

	function describeGroupAction(group: HistoryGroup): string {
		if (group.changes.some((change) => change.action === 'delete')) return 'deleted';
		if (group.changes.some((change) => change.action === 'create')) return 'created';
		return 'updated';
	}

	async function loadHistory() {
		isLoading = true;
		try {
			historyChanges = await onLoadHistory(200, 0);
			selectedChangeIds = new Set(historyChanges.map((change) => change.id));
		} finally {
			isLoading = false;
		}
	}

	export async function openAndLoad() {
		open = true;
		await loadHistory();
	}

	async function handleRevert() {
		const changeIds = Array.from(selectedChangeIds);
		if (changeIds.length === 0) return;
		isReverting = true;
		try {
			const reverted = await onRevertChanges(changeIds);
			if (reverted) {
				await loadHistory();
			}
		} finally {
			isReverting = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center md:items-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/40"
			onclick={() => (open = false)}
			aria-label="Close history"
		></button>
		<div class="relative z-10 w-full md:max-w-2xl max-h-[85vh] bg-white rounded-t-xl md:rounded-xl shadow-xl flex flex-col">
			<div class="flex items-center justify-between px-4 py-3 border-b border-slate-200">
				<h2 class="text-base font-semibold text-slate-800">Change History</h2>
				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" onclick={loadHistory} disabled={isLoading}>
						Reload
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={handleRevert}
						disabled={isReverting || selectedChangeIds.size === 0}
					>
						Revert Selected
					</Button>
					<Button variant="ghost" size="sm" onclick={() => (open = false)}>Close</Button>
				</div>
			</div>

			<div class="overflow-y-auto px-4 py-3 space-y-3">
				{#if isLoading}
					<p class="text-sm text-slate-500">Loading history...</p>
				{:else if historyGroups.length === 0}
					<p class="text-sm text-slate-500">No history entries yet.</p>
				{:else}
					{#each historyGroups as group}
						<div class="border border-slate-200 rounded-lg">
							<div class="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50">
								<button
									type="button"
									class="text-left flex-1"
									onclick={() => toggleGroup(group.id)}
								>
									<p class="text-sm font-medium text-slate-800">
										{group.userName} {describeGroupAction(group)} {getItemLabel(group.itemId)}
									</p>
									<p class="text-xs text-slate-500">{new Date(group.createdAt).toLocaleString()}</p>
								</button>
								<input
									type="checkbox"
									checked={group.changes.every((change) => isChangeSelected(change.id))}
									onchange={() => toggleGroupSelection(group)}
									aria-label="Select group"
								/>
							</div>

							{#if isGroupExpanded(group.id)}
								<div class="px-3 py-2 space-y-2">
									{#each group.changes as change}
										<label class="flex items-start gap-2 text-sm text-slate-700">
											<input
												type="checkbox"
												checked={isChangeSelected(change.id)}
												onchange={() => toggleChangeSelection(change.id)}
											/>
											<span>
												<strong>{change.action}</strong>
												{#if change.field}
													: {change.field}
												{/if}
											</span>
										</label>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
