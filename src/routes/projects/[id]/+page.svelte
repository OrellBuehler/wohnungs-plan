<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { Item } from '$lib/types';
	import type { CurrencyCode } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Menu, ArrowLeft, Share2 } from 'lucide-svelte';
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
	import { saveProject } from '$lib/db';
	import { downloadProject, importProjectFromJSON, readFileAsJSON } from '$lib/utils/export';
	import { fetchExchangeRates, convertCurrency, type ExchangeRates } from '$lib/utils/exchange';

	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import FloorplanCanvas from '$lib/components/canvas/FloorplanCanvas.svelte';
	import FloorplanUpload from '$lib/components/canvas/FloorplanUpload.svelte';
	import ScaleCalibration from '$lib/components/canvas/ScaleCalibration.svelte';
	import CanvasControls from '$lib/components/canvas/CanvasControls.svelte';
	import ItemList from '$lib/components/items/ItemList.svelte';
	import ItemForm from '$lib/components/items/ItemForm.svelte';

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

	// Track if project is local-only (not synced to cloud)
	let isLocalProject = $state(true);

	// Calibration state
	let pendingImageData = $state<string | null>(null);

	// Exchange rate state
	let exchangeRates = $state<ExchangeRates | null>(null);
	let isLoadingRates = $state(false);

	// Project name editing state
	let isEditingName = $state(false);
	let editNameValue = $state('');
	let nameInputEl = $state<HTMLInputElement | null>(null);

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

	function handleExport() {
		if (project) downloadProject(project);
	}

	async function handleImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (file) {
				const json = await readFileAsJSON(file);
				const imported = importProjectFromJSON(json);
				if (imported) {
					setProject(imported);
					await saveProject(imported);
				} else {
					alert('Invalid project file');
				}
			}
		};
		input.click();
	}

	// Floorplan actions
	function handleFloorplanUpload(imageData: string) {
		pendingImageData = imageData;
	}

	function handleCalibrate(scale: number, referenceLength: number) {
		if (pendingImageData) {
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
			if (selectedItemId === id) selectedItemId = null;
		}
	}

	function handleDuplicateItem(id: string) {
		duplicateItem(id);
	}

	function handlePlaceItem(id: string) {
		updateItem(id, { position: { x: canvasViewportCenter.x, y: canvasViewportCenter.y } });
		activeTab = 'plan';
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
			await fetch('/api/thumbnails', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: project.id,
					imageData: dataUrl
				})
			});
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
	<header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
		<div class="flex items-center gap-2">
			<Button variant="ghost" size="sm" onclick={() => goto('/')}>
				<ArrowLeft size={16} class="mr-1" />
				Projects
			</Button>
			<span class="text-slate-300">|</span>
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
		</div>

		<div class="flex items-center gap-2">
			{#if !isLocalProject}
				<Button variant="outline" size="sm" onclick={() => (showShareDialog = true)}>
					<Share2 size={16} class="mr-1" />
					Share
				</Button>
			{/if}
			{#if authed}
				<UserMenu />
			{:else}
				<LoginButton />
			{/if}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" size="sm">
							<Menu size={16} class="mr-1" /> Menu
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content>
					<DropdownMenu.Item onclick={handleExport}>Export JSON</DropdownMenu.Item>
					<DropdownMenu.Item onclick={handleImport}>Import JSON</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
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
						bind:viewportCenter={canvasViewportCenter}
						onItemSelect={handleItemSelect}
						onItemMove={handleItemMove}
						onItemRotate={handleItemRotate}
						onThumbnailReady={handleThumbnailReady}
					/>
				{/if}
			</div>

			{#if project.floorplan && !pendingImageData}
				<CanvasControls
					bind:showGrid
					bind:snapToGrid
					{gridSize}
					onChangeFloorplan={handleChangeFloorplan}
					onGridSizeChange={handleGridSizeChange}
				/>
			{/if}
		</div>

		<aside
			class="w-full md:w-80 min-h-0 {activeTab === 'items' ? 'flex' : 'hidden'} md:flex flex-col bg-white border-l border-slate-200"
		>
			<ItemList
				{items}
				{selectedItemId}
				{totalCost}
				{displayCurrency}
				{isLoadingRates}
				onItemSelect={handleItemSelect}
				onItemEdit={handleEditItem}
				onItemDelete={handleDeleteItem}
				onItemDuplicate={handleDuplicateItem}
				onItemPlace={handlePlaceItem}
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
		onSave={handleSaveItem}
		onClose={() => (showItemForm = false)}
	/>

	<ShareDialog
		bind:open={showShareDialog}
		projectId={project.id}
		onClose={() => (showShareDialog = false)}
	/>
{:else}
	<div class="flex-1 flex items-center justify-center">
		<p class="text-slate-500">Loading...</p>
	</div>
{/if}
