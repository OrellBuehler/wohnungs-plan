<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { Item, ItemChange } from '$lib/types';
	import type { CurrencyCode } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Menu, Share2, RefreshCw, GitBranchPlus, Pencil, Trash2 } from 'lucide-svelte';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import UserMenu from '$lib/components/auth/UserMenu.svelte';
	import ShareDialog from '$lib/components/sharing/ShareDialog.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { isAuthenticated } from '$lib/stores/auth.svelte';
	import type { PageData } from './$types';
	import {
		getProject,
		setProject,
		updateProjectName,
		setFloorplan,
		updateFloorplanScale,
		clearFloorplan,
		addItem,
		updateItem,
		deleteItem,
		duplicateItem,
		getItems,
		getBranches,
		getActiveBranch,
		setActiveBranch as setProjectActiveBranch,
		createProjectBranch,
		renameProjectBranch,
		deleteProjectBranch,
		getItemHistory,
		revertHistoryChanges,
		getCurrency,
		setCurrency,
		getGridSize,
		setGridSize,
		loadProjectById
	} from '$lib/stores/project.svelte';
	import { saveThumbnail } from '$lib/db';
	import { fetchExchangeRates, convertCurrency, type ExchangeRates } from '$lib/utils/exchange';

	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import FloorplanCanvas from '$lib/components/canvas/FloorplanCanvas.svelte';
	import FloorplanUpload from '$lib/components/canvas/FloorplanUpload.svelte';
	import ScaleCalibration from '$lib/components/canvas/ScaleCalibration.svelte';
	import CanvasControls from '$lib/components/canvas/CanvasControls.svelte';
	import ItemList from '$lib/components/items/ItemList.svelte';
	import ItemForm from '$lib/components/items/ItemForm.svelte';
	import ItemBottomSheet from '$lib/components/items/ItemBottomSheet.svelte';

	let { data }: { data: PageData } = $props();

	// Route params
	const projectId = $derived($page.params.id);

	// Auth state
	const authed = $derived(isAuthenticated());

	// App state
	let activeTab = $state<'plan' | 'items'>('plan');
	let selectedItemId = $state<string | null>(null);
	let showGrid = $state(true);
	let snapToGrid = $state(true);
	let canvasViewportCenter = $state({ x: 200, y: 200 });

	// Dialog state
	let showItemForm = $state(false);
	let editingItem = $state<Partial<Item> | null>(null);
	let showShareDialog = $state(false);
	let showItemBottomSheet = $state(false);
	let showHistory = $state(false);
	let isHistoryLoading = $state(false);
	let isRevertingHistory = $state(false);
	let historyChanges = $state<ItemChange[]>([]);
	let expandedHistoryGroups = $state<Set<string>>(new Set());
	let selectedHistoryChangeIds = $state<Set<string>>(new Set());

	// Track if project is local-only (not synced to cloud)
	let isLocalProject = $state(true);

	// Calibration state
	let pendingImageData = $state<string | null>(null);
	let isRecalibrating = $state(false);

	// Exchange rate state
	let exchangeRates = $state<ExchangeRates | null>(null);
	let isLoadingRates = $state(false);

	// Project name editing state
	let isEditingName = $state(false);
	let editNameValue = $state('');
	let nameInputEl = $state<HTMLInputElement | null>(null);

	// Mobile detection state
	let isMobile = $state(false);

	// Pull-to-refresh state
	let isRefreshing = $state(false);

	async function refreshProject() {
		if (isRefreshing || isLocalProject || !projectId) return;
		isRefreshing = true;
		try {
			const branchParam = $page.url.searchParams.get('branch') ?? undefined;
			const loaded = await loadProjectById(projectId, branchParam);
			if (loaded) setProject(loaded);
		} finally {
			isRefreshing = false;
		}
	}

	// Swipe detection for tab switching
	let swipeStartX = $state(0);
	let swipeStartY = $state(0);
	const SWIPE_THRESHOLD = 80; // px minimum swipe distance
	const SWIPE_MAX_Y = 50; // px max vertical movement (prevent diagonal swipes)

	function handleSwipeStart(e: TouchEvent) {
		if (!isMobile) return;
		const touch = e.touches[0];
		swipeStartX = touch.clientX;
		swipeStartY = touch.clientY;
	}

	function handleSwipeEnd(e: TouchEvent) {
		if (!isMobile) return;
		const touch = e.changedTouches[0];
		const dx = touch.clientX - swipeStartX;
		const dy = Math.abs(touch.clientY - swipeStartY);

		if (dy > SWIPE_MAX_Y) return; // Too much vertical movement

		if (dx < -SWIPE_THRESHOLD && activeTab === 'plan') {
			activeTab = 'items';
		} else if (dx > SWIPE_THRESHOLD && activeTab === 'items') {
			activeTab = 'plan';
		}
	}

	// Reactive project data
	const project = $derived(getProject());
	const items = $derived(getItems());
	const branches = $derived(getBranches());
	const activeBranch = $derived(getActiveBranch());
	const displayCurrency = $derived(getCurrency());
	const gridSize = $derived(getGridSize());

	async function handleBranchSelect(event: Event) {
		const target = event.currentTarget as HTMLSelectElement | null;
		const branchId = target?.value;
		if (!branchId) return;
		const switched = await setProjectActiveBranch(branchId);
		if (!switched) return;
		const url = new URL($page.url);
		url.searchParams.set('branch', branchId);
		await goto(`${url.pathname}?${url.searchParams.toString()}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	async function handleCreateBranch() {
		const branchName = prompt('New branch name');
		if (!branchName?.trim()) return;

		const created = await createProjectBranch(branchName, activeBranch?.id ?? null);
		if (!created) return;

		await setProjectActiveBranch(created.id);
		const url = new URL($page.url);
		url.searchParams.set('branch', created.id);
		await goto(`${url.pathname}?${url.searchParams.toString()}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	async function handleRenameBranch() {
		if (!activeBranch) return;
		const nextName = prompt('Rename branch', activeBranch.name);
		if (!nextName?.trim() || nextName.trim() === activeBranch.name) return;
		await renameProjectBranch(activeBranch.id, nextName.trim());
	}

	async function handleDeleteBranch() {
		if (!activeBranch) return;
		if (!confirm(`Delete branch "${activeBranch.name}"?`)) return;

		const deleted = await deleteProjectBranch(activeBranch.id);
		if (!deleted) return;

		const nextActive = getActiveBranch();
		if (!nextActive) return;
		const url = new URL($page.url);
		url.searchParams.set('branch', nextActive.id);
		await goto(`${url.pathname}?${url.searchParams.toString()}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	interface HistoryGroup {
		id: string;
		userId: string | null;
		userName: string;
		itemId: string;
		createdAt: string;
		changes: ItemChange[];
	}

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

	const historyGroups = $derived(groupHistoryEntries(historyChanges));

	function isGroupExpanded(groupId: string): boolean {
		return expandedHistoryGroups.has(groupId);
	}

	function toggleHistoryGroup(groupId: string): void {
		const next = new Set(expandedHistoryGroups);
		if (next.has(groupId)) {
			next.delete(groupId);
		} else {
			next.add(groupId);
		}
		expandedHistoryGroups = next;
	}

	function isChangeSelected(changeId: string): boolean {
		return selectedHistoryChangeIds.has(changeId);
	}

	function toggleChangeSelection(changeId: string): void {
		const next = new Set(selectedHistoryChangeIds);
		if (next.has(changeId)) {
			next.delete(changeId);
		} else {
			next.add(changeId);
		}
		selectedHistoryChangeIds = next;
	}

	function toggleGroupSelection(group: HistoryGroup): void {
		const next = new Set(selectedHistoryChangeIds);
		const hasAll = group.changes.every((change) => next.has(change.id));
		for (const change of group.changes) {
			if (hasAll) {
				next.delete(change.id);
			} else {
				next.add(change.id);
			}
		}
		selectedHistoryChangeIds = next;
	}

	function getHistoryItemLabel(itemId: string): string {
		const item = items.find((candidate) => candidate.id === itemId);
		return item?.name ?? `Item ${itemId.slice(0, 8)}`;
	}

	function describeGroupAction(group: HistoryGroup): string {
		if (group.changes.some((change) => change.action === 'delete')) return 'deleted';
		if (group.changes.some((change) => change.action === 'create')) return 'created';
		return 'updated';
	}

	async function loadHistory() {
		isHistoryLoading = true;
		try {
			historyChanges = await getItemHistory(200, 0);
			selectedHistoryChangeIds = new Set(historyChanges.map((change) => change.id));
		} finally {
			isHistoryLoading = false;
		}
	}

	async function handleOpenHistory() {
		showHistory = true;
		await loadHistory();
	}

	async function handleRevertHistory() {
		const changeIds = Array.from(selectedHistoryChangeIds);
		if (changeIds.length === 0) return;
		if (!confirm(`Revert ${changeIds.length} selected change(s)?`)) return;

		isRevertingHistory = true;
		try {
			const reverted = await revertHistoryChanges(changeIds);
			if (reverted) {
				await loadHistory();
			}
		} finally {
			isRevertingHistory = false;
		}
	}

	function handleGridSizeChange(newSize: number) {
		setGridSize(newSize);
	}

	// Calculate total cost with currency conversion
	const totalCost = $derived.by(() => {
		const rates = exchangeRates;
		if (!rates) {
			// No rates yet, just sum raw prices
			return items.reduce((sum, item) => sum + (item.price ?? 0), 0);
		}

		return items.reduce((sum, item) => {
			if (item.price === null) return sum;
			const converted = convertCurrency(item.price, item.priceCurrency, displayCurrency, rates);
			return sum + converted;
		}, 0);
	});

	// Fetch exchange rates when display currency changes
	$effect(() => {
		const currency = displayCurrency;
		loadExchangeRates(currency);
	});

	async function loadExchangeRates(baseCurrency: CurrencyCode) {
		isLoadingRates = true;
		try {
			exchangeRates = await fetchExchangeRates(baseCurrency);
		} finally {
			isLoadingRates = false;
		}
	}

	function handleDisplayCurrencyChange(newCurrency: CurrencyCode) {
		setCurrency(newCurrency);
	}

	onMount(async () => {
		const id = $page.params.id;
		if (!id) {
			goto('/');
			return;
		}
		const branchParam = $page.url.searchParams.get('branch') ?? undefined;
		const loaded = await loadProjectById(id, branchParam);
		if (loaded) {
			setProject(loaded);
			if (loaded.activeBranchId && loaded.activeBranchId !== branchParam) {
				const url = new URL($page.url);
				url.searchParams.set('branch', loaded.activeBranchId);
				await goto(`${url.pathname}?${url.searchParams.toString()}`, {
					replaceState: true,
					keepFocus: true,
					noScroll: true
				});
			}
			// If user is authenticated and project was loaded, check if it's a cloud project
			// by checking if the floorplan URL is a remote URL (not a data URL)
			if (authed && loaded.floorplan?.imageData?.startsWith('/api/')) {
				isLocalProject = false;
			}
		} else {
			goto('/');
		}
	});

	$effect(() => {
		const branchParam = $page.url.searchParams.get('branch');
		if (!branchParam || !activeBranch || branchParam === activeBranch.id) return;
		void setProjectActiveBranch(branchParam);
	});

	onMount(() => {
		// Mobile detection
		const updateMobile = () => {
			isMobile = window.innerWidth < 768; // md breakpoint
		};
		updateMobile();
		window.addEventListener('resize', updateMobile);
		return () => window.removeEventListener('resize', updateMobile);
	});

	// Header actions - Project name editing
	function startEditingName() {
		if (project) {
			editNameValue = project.name;
			isEditingName = true;
		}
	}

	function commitNameEdit() {
		const trimmed = editNameValue.trim();
		if (trimmed && project && trimmed !== project.name) {
			updateProjectName(trimmed);
		}
		isEditingName = false;
	}

	function cancelNameEdit() {
		isEditingName = false;
	}

	function handleNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitNameEdit();
		} else if (e.key === 'Escape') {
			cancelNameEdit();
		}
	}

	$effect(() => {
		if (isEditingName && nameInputEl) {
			nameInputEl.focus();
			nameInputEl.select();
		}
	});

	$effect(() => {
		// Close bottom sheet when switching tabs
		if (activeTab && showItemBottomSheet) {
			showItemBottomSheet = false;
		}
	});

	// Floorplan actions
	function handleFloorplanUpload(imageData: string) {
		pendingImageData = imageData;
	}

	function handleCalibrate(scale: number, referenceLength: number) {
		if (isRecalibrating) {
			// Update existing floorplan scale only (no re-upload)
			updateFloorplanScale(scale, referenceLength);
			isRecalibrating = false;
		} else if (pendingImageData) {
			// New floorplan upload
			setFloorplan({
				imageData: pendingImageData,
				scale,
				referenceLength
			});
			pendingImageData = null;
		}
	}

	function handleCancelCalibration() {
		pendingImageData = null;
		isRecalibrating = false;
	}

	function handleRecalibrate() {
		isRecalibrating = true;
	}

	function handleChangeFloorplan() {
		if (confirm('Change floorplan? Item positions will be kept.')) {
			clearFloorplan();
		}
	}

	// Item actions
	function handleAddItem() {
		editingItem = null;
		showItemForm = true;
	}

	function handleEditItem(id: string) {
		const item = items.find((i) => i.id === id);
		if (item) {
			editingItem = item;
			showItemForm = true;
		}
	}

	function handleSaveItem(itemData: Omit<Item, 'id'>) {
		if (editingItem?.id) {
			updateItem(editingItem.id, itemData);
		} else {
			addItem(itemData);
		}
	}

	function handleDeleteItem(id: string) {
		if (confirm('Delete this item?')) {
			deleteItem(id);
			if (selectedItemId === id) {
				selectedItemId = null;
				if (showItemBottomSheet) {
					showItemBottomSheet = false;
				}
			}
		}
	}

	function handleDuplicateItem(id: string) {
		duplicateItem(id);
	}

	function handlePlaceItem(id: string) {
		updateItem(id, { position: { x: canvasViewportCenter.x, y: canvasViewportCenter.y } });
		activeTab = 'plan';
	}

	function handleUnplaceItem(id: string) {
		updateItem(id, { position: null });
		if (selectedItemId === id) selectedItemId = null;
	}

	function handleItemTap(id: string | null) {
		if (id && isMobile) {
			selectedItemId = id;
			showItemBottomSheet = true;
		}
	}

	function handleItemBottomSheetEdit(id: string) {
		showItemBottomSheet = false;
		handleEditItem(id);
	}

	function handleItemBottomSheetClose() {
		showItemBottomSheet = false;
		selectedItemId = null;
	}

	function handleItemBottomSheetRotate(id: string, direction: 'cw' | 'ccw') {
		const item = items.find(i => i.id === id);
		if (item) {
			const delta = direction === 'cw' ? 90 : -90;
			handleItemRotate(id, (item.rotation + delta + 360) % 360);
		}
	}

	function handleItemBottomSheetDelete(id: string) {
		handleDeleteItem(id);
	}

	function handleItemBottomSheetDuplicate(id: string) {
		handleDuplicateItem(id);
		showItemBottomSheet = false;
	}

	function handleItemBottomSheetPlace(id: string) {
		handlePlaceItem(id);
		showItemBottomSheet = false;
	}

	function handleItemBottomSheetUnplace(id: string) {
		handleUnplaceItem(id);
	}

	// Canvas actions
	function handleItemSelect(id: string | null) {
		selectedItemId = id;
	}

	function handleItemMove(id: string, x: number, y: number) {
		updateItem(id, { position: { x, y } });
	}

	function handleItemRotate(id: string, rotation: number) {
		updateItem(id, { rotation });
	}

	async function handleThumbnailReady(dataUrl: string) {
		if (!project) return;
		try {
			if (project.isLocal) {
				// Save to IndexedDB for local projects
				await saveThumbnail(project.id, dataUrl);
			} else {
				// Upload to server for cloud projects
				const response = await fetch('/api/thumbnails', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						projectId: project.id,
						imageData: dataUrl
					})
				});
				if (!response.ok) {
					throw new Error(`Failed to upload thumbnail: ${response.status}`);
				}
			}
		} catch (error) {
			console.error('Failed to save thumbnail:', error);
		}
	}
</script>

{#if data.seo}
	<SEO
		title={data.seo.title}
		description={data.seo.description}
		image={data.seo.image}
		url={data.seo.url}
	/>
{/if}

{#if project}
	<header class="min-h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3 flex-shrink-0 gap-2" style="padding-top: max(0.75rem, env(safe-area-inset-top));">
		<div class="flex items-center gap-2 min-w-0 flex-1">
			<a href="/" class="flex items-center flex-shrink-0">
				<img src="/icon.svg" alt="Floorplanner" class="size-8" />
			</a>
			<span class="text-slate-300 flex-shrink-0">|</span>
			{#if isEditingName}
				<Input
					bind:ref={nameInputEl}
					bind:value={editNameValue}
					onblur={commitNameEdit}
					onkeydown={handleNameKeydown}
					class="w-auto max-w-64 text-lg font-semibold min-w-0"
				/>
			{:else}
				<Button
					variant="ghost"
					onclick={startEditingName}
					class="text-lg font-semibold text-slate-800 hover:text-slate-600 min-w-0 justify-start px-2"
				>
					<span class="truncate">{project.name}</span>
				</Button>
			{/if}

			{#if branches.length > 0}
				<div class="flex items-center gap-1.5 min-w-0">
					<select
						class="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 max-w-40"
						value={activeBranch?.id ?? ''}
						onchange={handleBranchSelect}
					>
						{#each branches as branch}
							<option value={branch.id}>{branch.name}</option>
						{/each}
					</select>
					<Button variant="outline" size="icon-sm" onclick={handleCreateBranch} title="Create branch">
						<GitBranchPlus size={14} />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={handleRenameBranch}
						disabled={!activeBranch}
						title="Rename branch"
					>
						<Pencil size={14} />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={handleDeleteBranch}
						disabled={!activeBranch || branches.length <= 1}
						title="Delete branch"
					>
						<Trash2 size={14} />
					</Button>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
			{#if !isLocalProject}
				<Button variant="outline" size="sm" onclick={() => (showShareDialog = true)}>
					<Share2 size={16} class="md:mr-1" />
					<span class="hidden md:inline">Share</span>
				</Button>
				<Button variant="outline" size="sm" onclick={handleOpenHistory}>
					<span class="hidden md:inline">History</span>
					<span class="md:hidden">Hist</span>
				</Button>
				<Button variant="outline" size="icon-sm" onclick={refreshProject} disabled={isRefreshing}>
					<RefreshCw size={16} class={isRefreshing ? 'animate-spin' : ''} />
					<span class="sr-only">Refresh</span>
				</Button>
			{/if}
			{#if authed}
				<UserMenu />
			{:else}
				<LoginButton />
			{/if}
			{#if project.floorplan && isMobile}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline" size="sm">
								<Menu size={16} class="md:mr-1" />
								<span class="hidden md:inline">Menu</span>
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						<DropdownMenu.Item onclick={handleRecalibrate}>Recalibrate Scale</DropdownMenu.Item>
						<DropdownMenu.Item onclick={handleChangeFloorplan}>Change Floorplan</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item onclick={() => showGrid = !showGrid}>
							{showGrid ? 'Hide Grid' : 'Show Grid'}
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => snapToGrid = !snapToGrid}>
							{snapToGrid ? 'Disable Snap' : 'Enable Snap'}
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</div>
	</header>

	<main class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
		<div class="flex-1 min-h-0 {activeTab === 'plan' ? 'flex' : 'hidden'} md:flex flex-col">
			<div class="flex-1 min-h-0 m-2 md:m-4 rounded-lg overflow-hidden">
				{#if pendingImageData}
					<ScaleCalibration
						imageData={pendingImageData}
						onCalibrate={handleCalibrate}
						onCancel={handleCancelCalibration}
					/>
				{:else if isRecalibrating && project.floorplan}
					<ScaleCalibration
						imageData={project.floorplan.imageData}
						initialReferenceLength={project.floorplan.referenceLength}
						onCalibrate={handleCalibrate}
						onCancel={handleCancelCalibration}
					/>
				{:else if !project.floorplan}
					<FloorplanUpload onUpload={handleFloorplanUpload} />
				{:else}
					<FloorplanCanvas
						floorplan={project.floorplan}
						{items}
						{selectedItemId}
						{gridSize}
						{showGrid}
						{snapToGrid}
						mobileMode={isMobile}
						bind:viewportCenter={canvasViewportCenter}
						onItemSelect={isMobile ? handleItemTap : handleItemSelect}
						onItemMove={handleItemMove}
						onItemRotate={handleItemRotate}
						onItemUnplace={handleUnplaceItem}
						onThumbnailReady={handleThumbnailReady}
					/>
				{/if}
			</div>

			{#if project.floorplan && !pendingImageData && !isRecalibrating && !isMobile}
				<CanvasControls
					bind:showGrid
					bind:snapToGrid
					{gridSize}
					scale={project.floorplan.scale}
					onChangeFloorplan={handleChangeFloorplan}
					onGridSizeChange={handleGridSizeChange}
					onRecalibrate={handleRecalibrate}
				/>
			{/if}
		</div>

		<aside
			class="w-full md:w-80 min-h-0 {activeTab === 'items' ? 'flex' : 'hidden'} md:flex flex-col bg-white border-l border-slate-200"
			ontouchstart={handleSwipeStart}
			ontouchend={handleSwipeEnd}
		>
			{#if isRefreshing}
				<div class="flex-shrink-0 flex items-center justify-center py-3 text-sm text-slate-500">
					<svg class="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
					</svg>
					Refreshing...
				</div>
			{/if}
			<ItemList
				{items}
				{selectedItemId}
				{totalCost}
				{displayCurrency}
				{isLoadingRates}
				readonly={isMobile}
				onItemSelect={handleItemSelect}
				onItemEdit={handleEditItem}
				onItemDelete={handleDeleteItem}
				onItemDuplicate={handleDuplicateItem}
				onItemPlace={handlePlaceItem}
				onItemUnplace={handleUnplaceItem}
				onAddItem={handleAddItem}
				onDisplayCurrencyChange={handleDisplayCurrencyChange}
			/>
		</aside>
	</main>

	{#if showHistory}
		<div class="fixed inset-0 z-50 flex items-end justify-center md:items-center">
			<button
				type="button"
				class="absolute inset-0 bg-black/40"
				onclick={() => (showHistory = false)}
				aria-label="Close history"
			></button>
			<div class="relative z-10 w-full md:max-w-2xl max-h-[85vh] bg-white rounded-t-xl md:rounded-xl shadow-xl flex flex-col">
				<div class="flex items-center justify-between px-4 py-3 border-b border-slate-200">
					<h2 class="text-base font-semibold text-slate-800">Change History</h2>
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" onclick={loadHistory} disabled={isHistoryLoading}>
							Reload
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={handleRevertHistory}
							disabled={isRevertingHistory || selectedHistoryChangeIds.size === 0}
						>
							Revert Selected
						</Button>
						<Button variant="ghost" size="sm" onclick={() => (showHistory = false)}>Close</Button>
					</div>
				</div>

				<div class="overflow-y-auto px-4 py-3 space-y-3">
					{#if isHistoryLoading}
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
										onclick={() => toggleHistoryGroup(group.id)}
									>
										<p class="text-sm font-medium text-slate-800">
											{group.userName} {describeGroupAction(group)} {getHistoryItemLabel(group.itemId)}
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

	<MobileNav {activeTab} onTabChange={(tab) => (activeTab = tab)} />

	<ItemForm
		bind:open={showItemForm}
		item={editingItem}
		defaultCurrency={displayCurrency}
		hidePositionFields={isMobile}
		onSave={handleSaveItem}
		onClose={() => (showItemForm = false)}
	/>

	<ShareDialog
		bind:open={showShareDialog}
		projectId={project.id}
		onClose={() => (showShareDialog = false)}
	/>

	<ItemBottomSheet
		bind:open={showItemBottomSheet}
		item={items.find((i) => i.id === selectedItemId) ?? null}
		onEdit={handleItemBottomSheetEdit}
		onClose={handleItemBottomSheetClose}
		onRotate={handleItemBottomSheetRotate}
		onDelete={handleItemBottomSheetDelete}
		onDuplicate={handleItemBottomSheetDuplicate}
		onPlace={handleItemBottomSheetPlace}
		onUnplace={handleItemBottomSheetUnplace}
	/>
{:else}
	<!-- Loading skeleton -->
	<div class="flex flex-col h-full">
		<!-- Header skeleton -->
		<header class="min-h-14 bg-white border-b border-slate-200 flex items-center px-4 py-3 gap-2">
			<div class="w-8 h-8 rounded bg-slate-200 animate-pulse"></div>
			<div class="w-px h-6 bg-slate-200"></div>
			<div class="h-6 w-40 rounded bg-slate-200 animate-pulse"></div>
			<div class="flex-1"></div>
			<div class="h-8 w-20 rounded bg-slate-200 animate-pulse"></div>
		</header>
		<!-- Canvas skeleton -->
		<main class="flex-1 flex flex-col md:flex-row overflow-hidden">
			<div class="flex-1 m-2 md:m-4 rounded-lg bg-slate-200 animate-pulse"></div>
			<aside class="hidden md:flex w-80 flex-col bg-white border-l border-slate-200 p-4 gap-3">
				{#each Array(4) as _}
					<div class="h-20 rounded bg-slate-200 animate-pulse"></div>
				{/each}
			</aside>
		</main>
	</div>
{/if}
