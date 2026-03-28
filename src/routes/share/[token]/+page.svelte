<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import type { Item, Floorplan } from '$lib/types';
	import type { CurrencyCode } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SEO from '$lib/components/SEO.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import FloorplanCanvas from '$lib/components/canvas/FloorplanCanvas.svelte';
	import ItemList from '$lib/components/items/ItemList.svelte';
	import ItemBottomSheet from '$lib/components/items/ItemBottomSheet.svelte';
	import * as m from '$lib/paraglide/messages';

	type ShareProject = {
		name: string;
		currency: string;
		gridSize: number;
	};

	type ShareBranch = {
		id: string;
		name: string;
		createdAt: string;
		forkedFromId: string | null;
	};

	type ShareItemApi = {
		id: string;
		name: string;
		width: number;
		height: number;
		rotation: number | null;
		color: string;
		price: number | null;
		priceCurrency: string | null;
		productUrl: string | null;
		x: number | null;
		y: number | null;
		shape: Item['shape'];
		cutoutWidth: number | null;
		cutoutHeight: number | null;
		cutoutCorner: Item['cutoutCorner'] | null;
	};

	type SharePayload = {
		project: ShareProject;
		items: ShareItemApi[];
		floorplan: {
			scale: number | null;
			referenceLength: number | null;
		} | null;
		branches: ShareBranch[];
		activeBranchId: string;
		requiresPassword?: boolean;
		projectName?: string;
	};

	let { data }: { data: PageData } = $props();

	const token = $derived($page.params.token);

	let activeTab = $state<'plan' | 'items' | 'comments'>('plan');
	let isMobile = $state(false);
	let isInvalid = $state(false);
	let requiresPassword = $state(false);
	let projectName = $state('');
	let password = $state('');
	let passwordError = $state<string | null>(null);
	let isVerifyingPassword = $state(false);
	let isLoading = $state(false);
	let isBranchSwitching = $state(false);
	let branchRequestId = 0;
	let loadError = $state<string | null>(null);
	let project = $state<ShareProject | null>(null);
	let items = $state<Item[]>([]);
	let floorplan = $state<Floorplan | null>(null);
	let branches = $state<ShareBranch[]>([]);
	let activeBranchId = $state<string | null>(null);
	let selectedItemId = $state<string | null>(null);
	let showGrid = $state(true);
	let snapToGrid = $state(true);
	let showItemBottomSheet = $state(false);
	let displayCurrency = $state<CurrencyCode>('EUR');

	const totalCost = $derived(items.reduce((sum, item) => sum + (item.price ?? 0), 0));
	const selectedItem = $derived(items.find((item) => item.id === selectedItemId) ?? null);

	function mapShareItems(apiItems: ShareItemApi[]): Item[] {
		return apiItems.map((item) => ({
			id: item.id,
			name: item.name,
			width: item.width,
			height: item.height,
			rotation: item.rotation ?? 0,
			color: item.color,
			price: item.price,
			priceCurrency: (item.priceCurrency ?? 'EUR') as CurrencyCode,
			productUrl: item.productUrl,
			position: item.x !== null && item.y !== null ? { x: item.x, y: item.y } : null,
			shape: item.shape,
			cutoutWidth: item.cutoutWidth ?? undefined,
			cutoutHeight: item.cutoutHeight ?? undefined,
			cutoutCorner: item.cutoutCorner ?? undefined
		}));
	}

	function applySharePayload(payload: SharePayload) {
		project = payload.project;
		projectName = payload.project.name;
		displayCurrency = payload.project.currency as CurrencyCode;
		items = mapShareItems(payload.items);
		branches = payload.branches;
		activeBranchId = payload.activeBranchId;
		floorplan = payload.floorplan
			? {
					imageData: `/api/share/${token}/floorplan`,
					scale: payload.floorplan.scale ?? 0,
					referenceLength: payload.floorplan.referenceLength ?? 0
				}
			: null;
	}

	async function loadShareData(branchId?: string) {
		if (isInvalid) return;

		if (branchId) {
			isBranchSwitching = true;
		} else {
			isLoading = true;
		}
		loadError = null;

		try {
			const query = branchId ? `?branch=${encodeURIComponent(branchId)}` : '';
			const response = await fetch(`/api/share/${token}${query}`);

			if (response.status === 404) {
				isInvalid = true;
				return;
			}

			if (!response.ok) {
				throw new Error(m.share_project_load_error());
			}

			const payload = (await response.json()) as SharePayload;
			if (payload.requiresPassword) {
				requiresPassword = true;
				projectName = payload.projectName ?? projectName;
				return;
			}

			requiresPassword = false;
			applySharePayload(payload);
		} catch (err) {
			loadError = err instanceof Error ? err.message : m.share_error_load_failed();
		} finally {
			isLoading = false;
			isBranchSwitching = false;
		}
	}

	async function handleBranchSelect(event: Event) {
		const target = event.currentTarget as HTMLSelectElement | null;
		const branchId = target?.value ?? '';
		if (!branchId || branchId === activeBranchId || isBranchSwitching) return;

		const requestId = ++branchRequestId;
		isBranchSwitching = true;
		loadError = null;
		try {
			const response = await fetch(`/api/share/${token}/branches/${branchId}/items`);
			if (requestId !== branchRequestId) return;
			if (response.status === 404) {
				isInvalid = true;
				return;
			}
			if (response.status === 401) {
				requiresPassword = true;
				return;
			}
			if (!response.ok) {
				throw new Error(m.share_branch_switch_error());
			}

			const payload = (await response.json()) as { items: ShareItemApi[] };
			if (requestId !== branchRequestId) return;
			items = mapShareItems(payload.items);
			activeBranchId = branchId;
			selectedItemId = null;
		} catch (err) {
			if (requestId !== branchRequestId) return;
			loadError = err instanceof Error ? err.message : m.share_branch_switch_error();
		} finally {
			if (requestId === branchRequestId) {
				isBranchSwitching = false;
			}
		}
	}

	async function handlePasswordSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!password || isVerifyingPassword) return;

		isVerifyingPassword = true;
		passwordError = null;
		try {
			const response = await fetch(`/api/share/${token}/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});

			if (response.ok) {
				requiresPassword = false;
				password = '';
				await loadShareData();
				return;
			}

			if (response.status === 429) {
				passwordError = m.share_error_too_many_attempts();
			} else {
				passwordError = m.share_error_wrong_password();
			}
		} catch {
			passwordError = m.share_error_verify_failed();
		} finally {
			isVerifyingPassword = false;
		}
	}

	function handleItemSelect(id: string | null) {
		selectedItemId = id;
	}

	function handleItemTap(id: string | null) {
		if (!id || !isMobile) return;
		selectedItemId = id;
		showItemBottomSheet = true;
	}

	function handleBottomSheetClose() {
		showItemBottomSheet = false;
		selectedItemId = null;
	}

	function noopDisplayCurrencyChange(currency: CurrencyCode) {
		displayCurrency = currency;
	}

	function noopItemMove(_id: string, _x: number, _y: number) {}
	function noopItemRotate(_id: string, _rotation: number) {}
	function noopItemUnplace(_id: string) {}
	function noopItemAction(_id: string) {}
	function noopItemRotateAction(_id: string, _direction: 'cw' | 'ccw') {}

	$effect(() => {
		isInvalid = data.error === 'invalid';
		requiresPassword = Boolean(data.requiresPassword);
		projectName = data.projectName ?? projectName;
	});

	onMount(() => {
		const media = window.matchMedia('(max-width: 767px)');
		const updateIsMobile = () => {
			isMobile = media.matches;
		};

		updateIsMobile();
		media.addEventListener('change', updateIsMobile);

		if (!isInvalid && !requiresPassword) {
			loadShareData();
		}

		return () => media.removeEventListener('change', updateIsMobile);
	});
</script>

{#if data.seo}
	<SEO
		title={data.seo.title}
		description={data.seo.description}
		image={data.seo.image}
		url={data.seo.url}
	/>
{/if}

{#if isInvalid}
	<div class="flex-1 flex items-center justify-center p-6">
		<div class="max-w-md w-full rounded-xl border bg-surface-container-lowest p-6 text-center space-y-4">
			<h1 class="text-xl font-semibold text-on-surface">{m.share_error_invalid_title()}</h1>
			<p class="text-sm text-on-surface-variant">{m.share_error_invalid_message()}</p>
			<a href="/">
				<Button variant="outline">{m.share_error_home()}</Button>
			</a>
		</div>
	</div>
{:else if requiresPassword}
	<div class="flex-1 flex items-center justify-center p-6">
		<form
			class="max-w-md w-full rounded-xl border bg-surface-container-lowest p-6 space-y-4"
			onsubmit={handlePasswordSubmit}
		>
			<h1 class="text-xl font-semibold text-on-surface">{projectName || m.share_default_title()}</h1>
			<p class="text-sm text-on-surface-variant">{m.share_password_prompt()}</p>
			<div class="space-y-2">
				<label class="text-sm font-medium text-on-surface" for="share-password"
					>{m.share_password_label()}</label
				>
				<Input
					id="share-password"
					type="password"
					bind:value={password}
					placeholder={m.share_password_placeholder()}
					disabled={isVerifyingPassword}
				/>
			</div>
			{#if passwordError}
				<p class="text-sm text-red-600">{passwordError}</p>
			{/if}
			<Button class="w-full" type="submit" disabled={!password || isVerifyingPassword}>
				{isVerifyingPassword ? m.share_password_verifying() : m.common_continue()}
			</Button>
		</form>
	</div>
{:else}
	<div class="h-full min-h-0 flex flex-col overflow-hidden">
		<header
			class="flex items-center justify-between px-3 py-2 md:px-6 md:py-3 bg-surface-container-lowest gap-3"
		>
			<div class="min-w-0 flex items-center gap-2">
				<a href="/" class="flex items-center gap-2">
					<img src="/icon.svg" alt="Floorplanner" class="h-6 w-6" />
					<span class="text-sm md:text-base font-semibold text-on-surface">Floorplanner</span>
				</a>
				<span class="hidden md:inline text-outline">|</span>
				<span class="truncate text-sm md:text-base text-on-surface"
					>{projectName || m.share_default_title()}</span
				>
			</div>

			<div class="flex items-center gap-2 flex-shrink-0">
				{#if branches.length > 0}
					<select
						class="h-9 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 text-sm text-on-surface"
						onchange={handleBranchSelect}
						value={activeBranchId ?? ''}
						disabled={isBranchSwitching}
					>
						{#each branches as branch (branch.id)}
							<option value={branch.id}>{branch.name}</option>
						{/each}
					</select>
				{/if}
				<span
					class="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
				>
					{m.share_badge()}
				</span>
			</div>
		</header>

		<main class="relative flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
			<div
				class="flex-1 min-w-0 min-h-0 {activeTab === 'plan' ? 'flex' : 'hidden'} md:flex flex-col"
			>
				<div class="flex-1 min-h-0 m-2 md:m-4 rounded-lg overflow-hidden bg-surface-container-lowest">
					{#if isLoading}
						<div class="h-full flex items-center justify-center text-sm text-on-surface-variant">
							{m.share_loading()}
						</div>
					{:else if loadError}
						<div class="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
							<p class="text-sm text-red-600">{loadError}</p>
							<Button variant="outline" onclick={() => loadShareData(activeBranchId ?? undefined)}>
								{m.common_retry()}
							</Button>
						</div>
					{:else if floorplan}
						<FloorplanCanvas
							{floorplan}
							{items}
							{selectedItemId}
							gridSize={project?.gridSize ?? 20}
							{showGrid}
							{snapToGrid}
							mobileMode={isMobile}
							onItemSelect={isMobile ? handleItemTap : handleItemSelect}
							onItemMove={noopItemMove}
							onItemRotate={noopItemRotate}
							onItemUnplace={noopItemUnplace}
						/>
					{:else}
						<div class="h-full flex items-center justify-center text-sm text-on-surface-variant">
							{m.share_no_floorplan()}
						</div>
					{/if}
				</div>
			</div>

			<aside
				class="w-full md:w-80 min-h-0 {activeTab === 'items'
					? 'flex'
					: 'hidden'} md:flex flex-col bg-surface-container-lowest"
			>
				<ItemList
					{items}
					{selectedItemId}
					{totalCost}
					{displayCurrency}
					isLoadingRates={false}
					readonly={true}
					onItemSelect={handleItemSelect}
					onItemEdit={noopItemAction}
					onItemDelete={noopItemAction}
					onItemDuplicate={noopItemAction}
					onItemPlace={noopItemAction}
					onItemUnplace={noopItemAction}
					onAddItem={() => {}}
					onDisplayCurrencyChange={noopDisplayCurrencyChange}
				/>
			</aside>

			{#if isBranchSwitching}
				<div
					class="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center"
				>
					<div
						class="rounded-md border bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
					>
						{m.branch_switching()}
					</div>
				</div>
			{/if}
		</main>

		<MobileNav {activeTab} onTabChange={(tab) => (activeTab = tab)} />

		<ItemBottomSheet
			bind:open={showItemBottomSheet}
			item={selectedItem}
			readonly={true}
			onEdit={noopItemAction}
			onClose={handleBottomSheetClose}
			onRotate={noopItemRotateAction}
			onDelete={noopItemAction}
			onDuplicate={noopItemAction}
			onPlace={noopItemAction}
			onUnplace={noopItemAction}
		/>
	</div>
{/if}
