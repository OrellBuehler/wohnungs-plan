<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { Item, ItemChange } from '$lib/types';
	import type { CurrencyCode } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Share2, RefreshCw, GitBranchPlus, Pencil, Trash2, History, Grid3x3, Magnet, Image, Crosshair, MessageSquare } from 'lucide-svelte';
	import SidebarTrigger from '$lib/components/layout/SidebarTrigger.svelte';
	import ShareDialog from '$lib/components/sharing/ShareDialog.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { isAuthenticated, waitForAuth } from '$lib/stores/auth.svelte';
	import { registerProjectContext, clearProjectContext } from '$lib/stores/sidebar.svelte';
	import type { ProjectActionGroup, BranchContext } from '$lib/stores/sidebar.svelte';
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
		getDefaultBranchId,
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
		loadProjectById,
		uploadItemImage,
		deleteItemImage as storeDeleteItemImage
	} from '$lib/stores/project.svelte';
	import { saveThumbnail } from '$lib/db';
	import { fetchExchangeRates, convertCurrency, type ExchangeRates } from '$lib/utils/exchange';
	import { shouldApplyUrlBranch } from '$lib/utils/branch-sync';
	import { loadComments, resetComments, enterPlacementMode, createCanvasComment, createComment, exitPlacementMode, isPlacementMode, getUnreadCount, markAllRead, setPendingComment, getPendingComment, setActiveComment, getActiveComment } from '$lib/stores/comments.svelte';
	import CommentPanel from '$lib/components/comments/CommentPanel.svelte';
	import PlacementOverlay from '$lib/components/comments/PlacementOverlay.svelte';

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
	let activeTab = $state<'plan' | 'items' | 'comments'>('plan');
	let showCommentsPanel = $state(false);
	let selectedItemId = $state<string | null>(null);
	let showGrid = $state(true);
	let snapToGrid = $state(true);
	let canvasRef = $state<{ getViewportCenterNatural: () => { x: number; y: number } } | null>(null);

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
	let showConfirmDialog = $state(false);
	let confirmDialogTitle = $state('');
	let confirmDialogDescription = $state('');
	let confirmDialogActionLabel = $state('Confirm');
	let confirmDialogActionVariant = $state<'default' | 'destructive'>('default');
	let confirmDialogAction = $state<(() => Promise<void> | void) | null>(null);
	let isConfirmActionPending = $state(false);
	let showBranchNameDialog = $state(false);
	let branchDialogMode = $state<'create' | 'rename'>('create');
	let branchDialogTargetId = $state<string | null>(null);
	let branchDialogOriginalName = $state('');
	let branchNameInputValue = $state('');
	let branchNameInputEl = $state<HTMLInputElement | null>(null);
	let isBranchDialogSubmitting = $state(false);
	let pendingBranchUrlSyncId = $state<string | null>(null);
	let isBranchSwitching = $state(false);

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

		if (dx < -SWIPE_THRESHOLD) {
			if (activeTab === 'plan') activeTab = 'items';
			else if (activeTab === 'items') activeTab = 'comments';
		} else if (dx > SWIPE_THRESHOLD) {
			if (activeTab === 'comments') activeTab = 'items';
			else if (activeTab === 'items') activeTab = 'plan';
		}
	}

	// Reactive project data
	const project = $derived(getProject());
	const items = $derived(getItems());
	const branches = $derived(getBranches());
	const activeBranch = $derived(getActiveBranch());
	const defaultBranchId = $derived(getDefaultBranchId());
	const displayCurrency = $derived(getCurrency());
	const gridSize = $derived(getGridSize());

	async function handleBranchSelect(event: Event) {
		const target = event.currentTarget as HTMLSelectElement | null;
		const branchId = target?.value;
		if (!branchId) return;
		if (branchId === activeBranch?.id) return;
		await switchBranchWithTransition(branchId);
	}

	async function syncBranchUrl(branchId: string) {
		const url = new URL($page.url);
		url.searchParams.set('branch', branchId);
		await goto(`${url.pathname}?${url.searchParams.toString()}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	async function switchBranchWithTransition(
		branchId: string,
		options: { syncUrl?: boolean; markPendingUrl?: boolean } = {}
	): Promise<boolean> {
		const { syncUrl = true, markPendingUrl = syncUrl } = options;
		if (isBranchSwitching) return false;

		let didSyncUrl = false;
		if (markPendingUrl) {
			pendingBranchUrlSyncId = branchId;
		}

		isBranchSwitching = true;
		try {
			const switched = await setProjectActiveBranch(branchId);
			if (!switched) return false;
			if (syncUrl) {
				await syncBranchUrl(branchId);
				didSyncUrl = true;
			}
			// Reload comments for the new branch
			if (projectId) loadComments(projectId, branchId);
			return true;
		} finally {
			if (pendingBranchUrlSyncId === branchId) {
				pendingBranchUrlSyncId = null;
			}
			isBranchSwitching = false;
		}
	}

	function openConfirmDialog(options: {
		title: string;
		description: string;
		actionLabel: string;
		actionVariant?: 'default' | 'destructive';
		action: () => Promise<void> | void;
	}) {
		confirmDialogTitle = options.title;
		confirmDialogDescription = options.description;
		confirmDialogActionLabel = options.actionLabel;
		confirmDialogActionVariant = options.actionVariant ?? 'default';
		confirmDialogAction = options.action;
		showConfirmDialog = true;
	}

	function closeConfirmDialog() {
		if (isConfirmActionPending) return;
		showConfirmDialog = false;
		confirmDialogAction = null;
	}

	async function handleConfirmDialogSubmit() {
		if (!confirmDialogAction || isConfirmActionPending) return;
		isConfirmActionPending = true;
		try {
			await confirmDialogAction();
			showConfirmDialog = false;
		} finally {
			isConfirmActionPending = false;
		}
	}

	function handleCreateBranch() {
		branchDialogMode = 'create';
		branchDialogTargetId = null;
		branchDialogOriginalName = '';
		branchNameInputValue = '';
		showBranchNameDialog = true;
	}

	function handleRenameBranch() {
		if (!activeBranch) return;
		branchDialogMode = 'rename';
		branchDialogTargetId = activeBranch.id;
		branchDialogOriginalName = activeBranch.name;
		branchNameInputValue = activeBranch.name;
		showBranchNameDialog = true;
	}

	function closeBranchNameDialog() {
		if (isBranchDialogSubmitting) return;
		showBranchNameDialog = false;
	}

	async function handleBranchDialogSubmit(event: Event) {
		event.preventDefault();
		if (isBranchDialogSubmitting) return;
		const branchName = branchNameInputValue.trim();
		if (!branchName) return;

		isBranchDialogSubmitting = true;
		try {
			if (branchDialogMode === 'rename') {
				if (!branchDialogTargetId || branchName === branchDialogOriginalName) {
					showBranchNameDialog = false;
					return;
				}
				await renameProjectBranch(branchDialogTargetId, branchName);
				showBranchNameDialog = false;
				return;
			}

			const created = await createProjectBranch(branchName, activeBranch?.id ?? null);
			if (!created) return;

			await switchBranchWithTransition(created.id);
			showBranchNameDialog = false;
		} finally {
			isBranchDialogSubmitting = false;
		}
	}

	function handleDeleteBranch() {
		if (!activeBranch) return;
		const branch = activeBranch;
		openConfirmDialog({
			title: 'Delete Branch',
			description: `Delete branch "${branch.name}"?`,
			actionLabel: 'Delete',
			actionVariant: 'destructive',
			action: async () => {
				const deleted = await deleteProjectBranch(branch.id);
				if (!deleted) return;

				const nextActive = getActiveBranch();
				if (!nextActive) return;
				await syncBranchUrl(nextActive.id);
			}
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

	function handleRevertHistory() {
		const changeIds = Array.from(selectedHistoryChangeIds);
		if (changeIds.length === 0) return;
		openConfirmDialog({
			title: 'Revert Selected Changes',
			description: `Revert ${changeIds.length} selected change(s)?`,
			actionLabel: 'Revert',
			actionVariant: 'destructive',
			action: async () => {
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
		});
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
		await waitForAuth();
		const branchParam = $page.url.searchParams.get('branch') ?? undefined;
		const loaded = await loadProjectById(id, branchParam);
		if (loaded) {
			setProject(loaded);
			if (loaded.activeBranchId && loaded.activeBranchId !== branchParam) {
				pendingBranchUrlSyncId = loaded.activeBranchId;
				try {
					await syncBranchUrl(loaded.activeBranchId);
				} finally {
					if (pendingBranchUrlSyncId === loaded.activeBranchId) {
						pendingBranchUrlSyncId = null;
					}
				}
			}
			// If user is authenticated and project was loaded, check if it's a cloud project
			// by checking if the floorplan URL is a remote URL (not a data URL)
			if (authed && loaded.floorplan?.imageData?.startsWith('/api/')) {
				isLocalProject = false;
			}
			// Load comments for this project
			if (loaded.activeBranchId) {
				loadComments(loaded.id, loaded.activeBranchId);
			}
		} else {
			goto('/');
		}
	});

	$effect(() => {
		const branchParam = $page.url.searchParams.get('branch');
		if (!branchParam) return;
		const activeBranchId = activeBranch?.id ?? null;
		if (!shouldApplyUrlBranch(branchParam, activeBranchId, pendingBranchUrlSyncId)) return;
		void switchBranchWithTransition(branchParam, { syncUrl: false, markPendingUrl: false });
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

	onDestroy(() => {
		clearProjectContext();
		resetComments();
	});

	// Register project context for sidebar
	$effect(() => {
		if (!project) return;

		const collaborationActions: ProjectActionGroup = {
			title: 'Collaboration',
			actions: [
				...(!isLocalProject
					? [
							{
								label: 'Share',
								icon: Share2,
								onclick: () => (showShareDialog = true)
							},
							{
								label: 'History',
								icon: History,
								onclick: () => handleOpenHistory()
							},
							{
								label: 'Refresh',
								icon: RefreshCw,
								onclick: () => refreshProject(),
								disabled: isRefreshing
							}
						]
					: [])
			]
		};

		const canvasActions: ProjectActionGroup = {
			title: 'Canvas',
			actions: [
				...(project.floorplan
					? [
							{
								label: 'Recalibrate Scale',
								icon: Crosshair,
								onclick: () => handleRecalibrate()
							},
							{
								label: 'Change Floorplan',
								icon: Image,
								onclick: () => handleChangeFloorplan()
							},
							{
								label: showGrid ? 'Hide Grid' : 'Show Grid',
								icon: Grid3x3,
								onclick: () => (showGrid = !showGrid),
								indicator: showGrid ? 'On' : 'Off'
							},
							{
								label: snapToGrid ? 'Disable Snap' : 'Enable Snap',
								icon: Magnet,
								onclick: () => (snapToGrid = !snapToGrid),
								indicator: snapToGrid ? 'On' : 'Off'
							}
						]
					: [])
			]
		};

		const actionGroups = [collaborationActions, canvasActions].filter(
			(g) => g.actions.length > 0
		);

		const branch: BranchContext | undefined =
			branches.length > 0
				? {
						branches: branches.map((b) => ({ id: b.id, name: b.name })),
						activeBranchId: activeBranch?.id ?? null,
						defaultBranchId,
						isSwitching: isBranchSwitching,
						onSelect: (branchId: string) => switchBranchWithTransition(branchId),
						onCreate: handleCreateBranch,
						onRename: handleRenameBranch,
						onDelete: handleDeleteBranch,
						canDelete: !!activeBranch && branches.length > 1 && !isBranchSwitching
					}
				: undefined;

		registerProjectContext({ actionGroups, branch });
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
		if (showBranchNameDialog && branchNameInputEl) {
			branchNameInputEl.focus();
			branchNameInputEl.select();
		}
	});

	let prevTab = activeTab;
	$effect(() => {
		// Close bottom sheet when switching tabs (only react to tab changes)
		const tab = activeTab;
		untrack(() => {
			if (tab !== prevTab) {
				prevTab = tab;
				showItemBottomSheet = false;
			}
		});
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
		openConfirmDialog({
			title: 'Change Floorplan',
			description: 'Change floorplan? Item positions will be kept.',
			actionLabel: 'Change',
			actionVariant: 'destructive',
			action: () => {
				clearFloorplan();
			}
		});
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

	async function handleSaveItem(itemData: Omit<Item, 'id'>, pendingFiles?: File[]) {
		if (editingItem?.id) {
			updateItem(editingItem.id, itemData);
		} else {
			const newItem = addItem(itemData);
			// Upload pending files for newly created items
			if (newItem && pendingFiles && pendingFiles.length > 0) {
				const results = await Promise.allSettled(
					pendingFiles.map((file) => uploadItemImage(newItem.id, file))
				);
				for (const result of results) {
					if (result.status === 'rejected') {
						console.error('Image upload failed:', result.reason);
					}
				}
			}
		}
	}

	function handleImageUpload(file: File) {
		if (!editingItem?.id) return Promise.resolve(null);
		return uploadItemImage(editingItem.id, file);
	}

	function handleImageDelete(imageId: string) {
		if (!editingItem?.id) return;
		void storeDeleteItemImage(editingItem.id, imageId);
	}

	function handleDeleteItem(id: string) {
		openConfirmDialog({
			title: 'Delete Item',
			description: 'Delete this item?',
			actionLabel: 'Delete',
			actionVariant: 'destructive',
			action: () => {
				deleteItem(id);
				if (selectedItemId === id) {
					selectedItemId = null;
					if (showItemBottomSheet) {
						showItemBottomSheet = false;
					}
				}
			}
		});
	}

	function handleDuplicateItem(id: string) {
		duplicateItem(id);
	}

	function handlePlaceItem(id: string) {
		const center = canvasRef?.getViewportCenterNatural() ?? { x: 200, y: 200 };
		updateItem(id, { position: { x: center.x, y: center.y } });
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

	// Comment actions
	function handleCommentPlace(x: number, y: number) {
		setPendingComment({ x, y });
	}

	function handlePlaceCommentMobile(_screenX: number, _screenY: number) {
		const center = canvasRef?.getViewportCenterNatural();
		if (!center) return;
		setPendingComment({ x: center.x, y: center.y });
	}

	async function handleSubmitPendingComment(body: string) {
		const pending = getPendingComment();
		if (!pending) return;
		const pid = projectId;
		const branchId = activeBranch?.id;
		if (!pid || !branchId) return;
		await createCanvasComment(pid, branchId, pending.x, pending.y, body);
		setPendingComment(null);
	}

	function handleCancelPendingComment() {
		setPendingComment(null);
	}

	async function handleCreateComment(body: string) {
		const pid = projectId;
		const branchId = activeBranch?.id;
		if (!pid || !branchId) return;
		await createComment(pid, branchId, body);
	}

	function handlePlaceOnMap() {
		activeTab = 'plan';
		enterPlacementMode();
	}

	function handleCloseCommentsPanel() {
		showCommentsPanel = false;
	}

	// Derive unread count for header badge
	const unreadCount = $derived(getUnreadCount());

	// Derive whether comment panel should be open on desktop
	const commentsPanelOpen = $derived(showCommentsPanel || getPendingComment() !== null || getActiveComment() !== null);

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
		const activeBranchId = activeBranch?.id ?? null;
		if (!defaultBranchId || !activeBranchId || activeBranchId !== defaultBranchId) return;

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
						branchId: activeBranchId,
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
				<button
					type="button"
					onclick={isMobile ? undefined : startEditingName}
					class="text-lg font-semibold text-slate-800 min-w-0 truncate {isMobile ? '' : 'hover:text-slate-600 cursor-pointer'}"
				>
					{project.name}
				</button>
			{/if}

			{#if branches.length > 0}
				<div class="hidden md:flex items-center gap-1.5 min-w-0">
					<select
						class="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 max-w-40"
						value={activeBranch?.id ?? ''}
						disabled={isBranchSwitching}
						onchange={handleBranchSelect}
					>
						{#each branches as branch}
							<option value={branch.id}>{branch.name}</option>
						{/each}
					</select>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={handleCreateBranch}
						disabled={isBranchSwitching}
						title="Create branch"
					>
						<GitBranchPlus size={14} />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={handleRenameBranch}
						disabled={!activeBranch || isBranchSwitching}
						title="Rename branch"
					>
						<Pencil size={14} />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={handleDeleteBranch}
						disabled={!activeBranch || branches.length <= 1 || isBranchSwitching}
						title="Delete branch"
					>
						<Trash2 size={14} />
					</Button>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
			{#if !isLocalProject}
				<Button variant="outline" size="sm" class="hidden md:inline-flex" onclick={() => (showShareDialog = true)}>
					<Share2 size={16} class="mr-1" />
					Share
				</Button>
				<Button variant="outline" size="sm" class="hidden md:inline-flex" onclick={handleOpenHistory}>
					History
				</Button>
				<Button variant="outline" size="icon-sm" class="hidden md:inline-flex" onclick={refreshProject} disabled={isRefreshing}>
					<RefreshCw size={16} class={isRefreshing ? 'animate-spin' : ''} />
					<span class="sr-only">Refresh</span>
				</Button>
			{/if}
			<Button
				variant="outline"
				size="sm"
				class="hidden md:inline-flex relative"
				onclick={() => { showCommentsPanel = !showCommentsPanel; markAllRead(); }}
			>
				<MessageSquare size={16} class="mr-1" />
				Comments
				{#if unreadCount > 0}
					<span class="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-indigo-600 text-white text-[10px] font-bold px-1">
						{unreadCount}
					</span>
				{/if}
			</Button>
			<SidebarTrigger />
		</div>
	</header>

	<main class="relative flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
		<div class="flex-1 min-w-0 min-h-0 {activeTab === 'plan' ? 'flex' : 'hidden'} md:flex flex-col">
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
							bind:this={canvasRef}
							floorplan={project.floorplan}
							{items}
							{selectedItemId}
							{gridSize}
							{showGrid}
							{snapToGrid}
							mobileMode={isMobile}
							onItemSelect={isMobile ? handleItemTap : handleItemSelect}
							onItemMove={handleItemMove}
							onItemRotate={handleItemRotate}
						onItemUnplace={handleUnplaceItem}
						onThumbnailReady={handleThumbnailReady}
						onCommentPlace={handleCommentPlace}
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

		<!-- Mobile: Comments tab content -->
		{#if isMobile}
			<div
				class="w-full min-h-0 {activeTab === 'comments' ? 'flex' : 'hidden'} flex-col bg-white"
				ontouchstart={handleSwipeStart}
				ontouchend={handleSwipeEnd}
			>
				<CommentPanel
					projectId={project.id}
					canEdit={true}
					{isMobile}
					open={activeTab === 'comments' || getPendingComment() !== null}
					branchId={activeBranch?.id ?? null}
					onSubmitPending={handleSubmitPendingComment}
					onCancelPending={handleCancelPendingComment}
					onPlaceOnMap={handlePlaceOnMap}
					onCreateComment={handleCreateComment}
				/>
			</div>
		{:else}
			<!-- Desktop: Side panel -->
			<CommentPanel
				projectId={project.id}
				canEdit={true}
				{isMobile}
				open={commentsPanelOpen}
				branchId={activeBranch?.id ?? null}
				onSubmitPending={handleSubmitPendingComment}
				onCancelPending={handleCancelPendingComment}
				onClose={handleCloseCommentsPanel}
				onPlaceOnMap={handlePlaceOnMap}
				onCreateComment={handleCreateComment}
			/>
		{/if}

		{#if isBranchSwitching}
			<div class="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
				<div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
					Switching branch...
				</div>
			</div>
		{/if}
	</main>

	<!-- Comment placement overlay -->
	<PlacementOverlay {isMobile} onPlace={handlePlaceCommentMobile} />

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

	<MobileNav {activeTab} onTabChange={(tab) => { activeTab = tab; if (tab === 'comments') markAllRead(); }} {unreadCount} />

	<ItemForm
		bind:open={showItemForm}
		item={editingItem}
		defaultCurrency={displayCurrency}
		existingImages={editingItem?.id ? (items.find((i) => i.id === editingItem?.id)?.images ?? []) : []}
		hidePositionFields={isMobile}
		onSave={handleSaveItem}
		onClose={() => (showItemForm = false)}
		onImageUpload={handleImageUpload}
		onImageDelete={handleImageDelete}
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

	<Dialog.Root bind:open={showBranchNameDialog} onOpenChange={(open) => !open && closeBranchNameDialog()}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>{branchDialogMode === 'create' ? 'Create Branch' : 'Rename Branch'}</Dialog.Title>
				<Dialog.Description>
					{branchDialogMode === 'create'
						? 'Enter a name for the new branch.'
						: 'Update the selected branch name.'}
				</Dialog.Description>
			</Dialog.Header>
			<form onsubmit={handleBranchDialogSubmit} class="space-y-4">
				<Input
					bind:ref={branchNameInputEl}
					bind:value={branchNameInputValue}
					placeholder="Branch name"
				/>
				<Dialog.Footer class="gap-2">
					<Button type="button" variant="outline" class="w-full sm:w-auto" onclick={closeBranchNameDialog}>Cancel</Button>
					<Button
						type="submit"
						class="w-full sm:w-auto"
						disabled={isBranchDialogSubmitting || !branchNameInputValue.trim()}
					>
						{branchDialogMode === 'create' ? 'Create' : 'Save'}
					</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={showConfirmDialog} onOpenChange={(open) => !open && closeConfirmDialog()}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>{confirmDialogTitle}</Dialog.Title>
				<Dialog.Description class="break-words">{confirmDialogDescription}</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer class="gap-2">
				<Button type="button" variant="outline" class="w-full sm:w-auto" onclick={closeConfirmDialog}>Cancel</Button>
				<Button
					type="button"
					class="w-full sm:w-auto"
					variant={confirmDialogActionVariant}
					onclick={handleConfirmDialogSubmit}
					disabled={isConfirmActionPending}
				>
					{confirmDialogActionLabel}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
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
