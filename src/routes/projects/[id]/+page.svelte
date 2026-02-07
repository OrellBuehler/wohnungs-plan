<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { Item } from '$lib/types';
	import type { CurrencyCode } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Menu, Share2 } from 'lucide-svelte';
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
			const loaded = await loadProjectById(projectId);
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
	const displayCurrency = $derived(getCurrency());
	const gridSize = $derived(getGridSize());

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
		const loaded = await loadProjectById(id);
		if (loaded) {
			setProject(loaded);
			// If user is authenticated and project was loaded, check if it's a cloud project
			// by checking if the floorplan URL is a remote URL (not a data URL)
			if (authed && loaded.floorplan?.imageData?.startsWith('/api/')) {
				isLocalProject = false;
			}
		} else {
			goto('/');
		}
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
		</div>

		<div class="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
			{#if !isLocalProject}
				<Button variant="outline" size="sm" onclick={() => (showShareDialog = true)}>
					<Share2 size={16} class="md:mr-1" />
					<span class="hidden md:inline">Share</span>
				</Button>
			{/if}
			{#if authed}
				<UserMenu />
			{:else}
				<LoginButton />
			{/if}
			{#if !isLocalProject || (project.floorplan && isMobile)}
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
						{#if !isLocalProject}
							<DropdownMenu.Item onclick={refreshProject}>
								{isRefreshing ? 'Refreshing...' : 'Refresh'}
							</DropdownMenu.Item>
						{/if}
						{#if project.floorplan && isMobile}
							{#if !isLocalProject}<DropdownMenu.Separator />{/if}
							<DropdownMenu.Item onclick={handleRecalibrate}>Recalibrate Scale</DropdownMenu.Item>
							<DropdownMenu.Item onclick={handleChangeFloorplan}>Change Floorplan</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item onclick={() => showGrid = !showGrid}>
								{showGrid ? 'Hide Grid' : 'Show Grid'}
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => snapToGrid = !snapToGrid}>
								{snapToGrid ? 'Disable Snap' : 'Enable Snap'}
							</DropdownMenu.Item>
						{/if}
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
