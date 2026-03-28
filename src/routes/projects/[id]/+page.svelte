<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { Item } from '$lib/types';
	import type { CurrencyCode } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
	import Share2 from '@lucide/svelte/icons/share-2';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import GitBranchPlus from '@lucide/svelte/icons/git-branch-plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Grid3x3 from '@lucide/svelte/icons/grid-3x3';
	import Magnet from '@lucide/svelte/icons/magnet';
	import Image from '@lucide/svelte/icons/image';
	import Crosshair from '@lucide/svelte/icons/crosshair';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import * as m from '$lib/paraglide/messages';
	import { toast } from 'svelte-sonner';
	import SidebarTrigger from '$lib/components/layout/SidebarTrigger.svelte';
	import OfflineBadge from '$lib/components/shared/OfflineBadge.svelte';
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
	import {
		loadComments,
		resetComments,
		enterPlacementMode,
		createComment,
		updateCommentPosition,
		exitPlacementMode,
		isPlacementMode,
		getUnreadCount,
		markAllRead,
		setPendingComment,
		getPendingComment,
		getPinningCommentId,
		setActiveComment,
		getActiveComment
	} from '$lib/stores/comments.svelte';
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
	import McpToolsDialog from '$lib/components/projects/McpToolsDialog.svelte';

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
	let showMcpToolsDialog = $state(false);
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
			title: m.branch_delete_title(),
			description: m.branch_delete_description({ name: branch.name }),
			actionLabel: m.common_delete(),
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

	function handleOpenHistory() {
		goto(`/projects/${projectId}/history`);
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
			toast.error(m.error_load_project());
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
		// Mobile detection via matchMedia (fires only on breakpoint crossing)
		const mql = window.matchMedia('(max-width: 767px)');
		isMobile = mql.matches;
		const handleChange = (e: MediaQueryListEvent) => {
			isMobile = e.matches;
		};
		mql.addEventListener('change', handleChange);
		return () => mql.removeEventListener('change', handleChange);
	});

	onDestroy(() => {
		clearProjectContext();
		resetComments();
	});

	// Register project context for sidebar
	$effect(() => {
		if (!project) return;

		const collaborationActions: ProjectActionGroup = {
			title: m.project_sidebar_group_collaboration(),
			actions: [
				...(!isLocalProject
					? [
							{
								label: m.project_share(),
								icon: Share2,
								onclick: () => (showShareDialog = true)
							},
							{
								label: m.project_refresh(),
								icon: RefreshCw,
								onclick: () => refreshProject(),
								disabled: isRefreshing
							},
							{
								label: m.project_mcp_tools(),
								icon: Settings2,
								onclick: () => (showMcpToolsDialog = true)
							}
						]
					: [])
			]
		};

		const canvasActions: ProjectActionGroup = {
			title: m.project_sidebar_group_canvas(),
			actions: [
				...(project.floorplan
					? [
							{
								label: m.project_recalibrate(),
								icon: Crosshair,
								onclick: () => handleRecalibrate()
							},
							{
								label: m.project_change_floorplan(),
								icon: Image,
								onclick: () => handleChangeFloorplan()
							},
							{
								label: showGrid ? m.project_hide_grid() : m.project_show_grid(),
								icon: Grid3x3,
								onclick: () => (showGrid = !showGrid),
								indicator: showGrid ? m.project_sidebar_toggle_on() : m.project_sidebar_toggle_off()
							},
							{
								label: snapToGrid ? m.project_disable_snap() : m.project_enable_snap(),
								icon: Magnet,
								onclick: () => (snapToGrid = !snapToGrid),
								indicator: snapToGrid
									? m.project_sidebar_toggle_on()
									: m.project_sidebar_toggle_off()
							}
						]
					: [])
			]
		};

		const actionGroups = [collaborationActions, canvasActions].filter((g) => g.actions.length > 0);

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
			title: m.project_change_floorplan_title(),
			description: m.project_change_floorplan_description(),
			actionLabel: m.common_change(),
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
				if (results.some((r) => r.status === 'rejected')) {
					toast.error(m.item_image_upload_error());
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
			title: m.item_delete_title(),
			description: m.item_delete_description(),
			actionLabel: m.common_delete(),
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
		const item = items.find((i) => i.id === id);
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
		const pinningId = getPinningCommentId();
		if (pinningId) {
			// Pinning an existing comment to this position
			const pid = projectId;
			if (pid) {
				updateCommentPosition(pid, pinningId, x, y);
				exitPlacementMode();
				setActiveComment(pinningId);
			}
			return;
		}
		setPendingComment({ x, y });
	}

	function handleCommentMove(commentId: string, x: number, y: number) {
		const pid = projectId;
		if (pid) {
			updateCommentPosition(pid, commentId, x, y);
		}
	}

	function handlePlaceCommentMobile(_screenX: number, _screenY: number) {
		const center = canvasRef?.getViewportCenterNatural();
		if (!center) return;
		const pinningId = getPinningCommentId();
		if (pinningId) {
			const pid = projectId;
			if (pid) {
				updateCommentPosition(pid, pinningId, center.x, center.y);
				exitPlacementMode();
				setActiveComment(pinningId);
			}
			return;
		}
		setPendingComment({ x: center.x, y: center.y });
	}

	async function handleSubmitPendingComment(body: string) {
		const pending = getPendingComment();
		if (!pending) return;
		const pid = projectId;
		const branchId = activeBranch?.id;
		if (!pid || !branchId) return;
		await createComment(pid, branchId, body, { x: pending.x, y: pending.y });
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

	function handlePinCommentToMap(commentId: string) {
		activeTab = 'plan';
		enterPlacementMode(commentId);
	}

	function handleCloseCommentsPanel() {
		showCommentsPanel = false;
	}

	// Derive unread count for header badge
	const unreadCount = $derived(getUnreadCount());

	// Derive whether comment panel should be open on desktop
	const commentsPanelOpen = $derived(
		showCommentsPanel || getPendingComment() !== null || getActiveComment() !== null
	);

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
			} else if (authed) {
				// Upload to server for cloud projects (only when authenticated)
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
		} catch {
			// thumbnail save is a background operation; silently ignore
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
	<header
		class="min-h-14 bg-surface-container-lowest/80 backdrop-blur-[12px] flex items-center justify-between px-4 py-3 flex-shrink-0 gap-2"
		style="padding-top: max(0.75rem, env(safe-area-inset-top));"
	>
		<div class="flex items-center gap-2 min-w-0 flex-1">
			<a href="/" class="flex items-center flex-shrink-0 md:hidden">
				<img src="/icon.svg" alt="Floorplanner" class="size-8" />
			</a>
			<span class="text-outline flex-shrink-0 md:hidden">|</span>
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
					class="font-display text-lg font-semibold text-on-surface min-w-0 truncate {isMobile
						? ''
						: 'hover:text-on-surface-variant cursor-pointer'}"
				>
					{project.name}
				</button>
			{/if}

			{#if branches.length > 0}
				<div class="hidden md:flex items-center gap-1.5 min-w-0">
					<select
						class="h-8 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 text-sm text-on-surface max-w-40"
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
						title={m.branch_create_title()}
					>
						<GitBranchPlus size={14} />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={handleRenameBranch}
						disabled={!activeBranch || isBranchSwitching}
						title={m.branch_rename_title()}
					>
						<Pencil size={14} />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onclick={handleDeleteBranch}
						disabled={!activeBranch || branches.length <= 1 || isBranchSwitching}
						title={m.branch_delete_title()}
					>
						<Trash2 size={14} />
					</Button>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
			{#if !isLocalProject}
				<Button
					variant="outline"
					size="sm"
					class="hidden md:inline-flex"
					onclick={() => (showShareDialog = true)}
				>
					<Share2 size={16} class="mr-1" />
					{m.project_share()}
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="hidden md:inline-flex"
					onclick={handleOpenHistory}
				>
					{m.project_history()}
				</Button>
				<Button
					variant="outline"
					size="icon-sm"
					class="hidden md:inline-flex"
					onclick={refreshProject}
					disabled={isRefreshing}
				>
					<RefreshCw size={16} class={isRefreshing ? 'animate-spin' : ''} />
					<span class="sr-only">{m.project_refresh()}</span>
				</Button>
			{/if}
			<Button
				variant="outline"
				size="sm"
				class="hidden md:inline-flex relative"
				onclick={() => {
					showCommentsPanel = !showCommentsPanel;
					markAllRead();
				}}
			>
				<MessageSquare size={16} class="mr-1" />
				Comments
				{#if unreadCount > 0}
					<span
						class="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-secondary text-white text-[10px] font-bold px-1"
					>
						{unreadCount}
					</span>
				{/if}
			</Button>
			<OfflineBadge />
			<div class="md:hidden">
				<SidebarTrigger />
			</div>
		</div>
	</header>

	<main class="relative flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
		<div
			class="flex-1 min-w-0 min-h-0 {activeTab === 'plan' || activeTab === 'comments'
				? 'flex'
				: 'hidden'} md:flex flex-col"
		>
			<div
				class="{activeTab === 'comments' && isMobile
					? 'h-[40vh] flex-shrink-0'
					: 'flex-1'} min-h-0 m-2 md:m-4 rounded-lg overflow-hidden"
			>
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
						onCommentMove={handleCommentMove}
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

			<!-- Mobile: Comments panel below canvas when comments tab is active -->
			{#if isMobile && activeTab === 'comments'}
				<div class="flex-1 min-h-0">
					<CommentPanel
						projectId={project.id}
						canEdit={true}
						{isMobile}
						open={true}
						branchId={activeBranch?.id ?? null}
						onSubmitPending={handleSubmitPendingComment}
						onCancelPending={handleCancelPendingComment}
						onPlaceOnMap={handlePlaceOnMap}
						onCreateComment={handleCreateComment}
						onPinCommentToMap={handlePinCommentToMap}
					/>
				</div>
			{/if}
		</div>

		<aside
			class="w-full md:w-80 min-h-0 {activeTab === 'items'
				? 'flex'
				: 'hidden'} md:flex flex-col bg-surface-container-low"
			ontouchstart={handleSwipeStart}
			ontouchend={handleSwipeEnd}
		>
			{#if isRefreshing}
				<div class="flex-shrink-0 flex items-center justify-center py-3 text-sm text-on-surface-variant">
					<svg class="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
							fill="none"
						/>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						/>
					</svg>
					{m.project_refreshing()}
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

		{#if !isMobile}
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
				onPinCommentToMap={handlePinCommentToMap}
			/>
		{/if}

		{#if isBranchSwitching}
			<div
				class="absolute inset-0 z-40 bg-surface-container-lowest/70 backdrop-blur-[1px] flex items-center justify-center"
			>
				<div
					class="rounded-md bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
				>
					{m.branch_switching()}
				</div>
			</div>
		{/if}
	</main>

	<!-- Comment placement overlay -->
	<PlacementOverlay {isMobile} onPlace={handlePlaceCommentMobile} />

	<MobileNav
		{activeTab}
		onTabChange={(tab) => {
			activeTab = tab;
			if (tab === 'comments') markAllRead();
		}}
		{unreadCount}
	/>

	<ItemForm
		bind:open={showItemForm}
		item={editingItem}
		defaultCurrency={displayCurrency}
		existingImages={editingItem?.id
			? (items.find((i) => i.id === editingItem?.id)?.images ?? [])
			: []}
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

	<McpToolsDialog
		bind:open={showMcpToolsDialog}
		projectId={project.id}
		onClose={() => (showMcpToolsDialog = false)}
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

	<Dialog.Root
		bind:open={showBranchNameDialog}
		onOpenChange={(open) => !open && closeBranchNameDialog()}
	>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title
					>{branchDialogMode === 'create'
						? m.branch_create_title()
						: m.branch_rename_title()}</Dialog.Title
				>
				<Dialog.Description>
					{branchDialogMode === 'create'
						? m.branch_create_description()
						: m.branch_rename_description()}
				</Dialog.Description>
			</Dialog.Header>
			<form onsubmit={handleBranchDialogSubmit} class="space-y-4">
				<Input
					bind:ref={branchNameInputEl}
					bind:value={branchNameInputValue}
					placeholder={m.branch_name_placeholder()}
				/>
				<Dialog.Footer class="gap-2">
					<Button
						type="button"
						variant="outline"
						class="w-full sm:w-auto"
						onclick={closeBranchNameDialog}>{m.common_cancel()}</Button
					>
					<Button
						type="submit"
						class="w-full sm:w-auto"
						disabled={isBranchDialogSubmitting || !branchNameInputValue.trim()}
					>
						{branchDialogMode === 'create' ? m.common_create() : m.common_save()}
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
				<Button
					type="button"
					variant="outline"
					class="w-full sm:w-auto"
					onclick={closeConfirmDialog}>{m.common_cancel()}</Button
				>
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
		<header class="min-h-14 bg-surface-container-lowest/80 backdrop-blur-[12px] flex items-center px-4 py-3 gap-2">
			<div class="w-8 h-8 rounded bg-surface-container-high animate-pulse"></div>
			<div class="w-px h-6 bg-surface-container-high"></div>
			<div class="h-6 w-40 rounded bg-surface-container-high animate-pulse"></div>
			<div class="flex-1"></div>
			<div class="h-8 w-20 rounded bg-surface-container-high animate-pulse"></div>
		</header>
		<!-- Canvas skeleton -->
		<main class="flex-1 flex flex-col md:flex-row overflow-hidden">
			<div class="flex-1 m-2 md:m-4 rounded-lg bg-surface-container-high animate-pulse"></div>
			<aside class="hidden md:flex w-80 flex-col bg-surface-container-low p-4 gap-3">
				{#each Array(4) as _}
					<div class="h-20 rounded bg-surface-container-high animate-pulse"></div>
				{/each}
			</aside>
		</main>
	</div>
{/if}
