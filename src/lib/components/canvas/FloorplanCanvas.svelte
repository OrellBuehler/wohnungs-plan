<script lang="ts">
	import {
		Stage,
		Layer,
		Shape,
		Image as KonvaImage,
		Rect,
		Line,
		Text,
		Group,
		Circle
	} from 'svelte-konva';
	import type { Item, Floorplan } from '#lib/types/index.ts';
	import type Konva from 'konva';
	import type { Context } from 'konva/lib/Context';
	import type { Shape as KonvaShape } from 'konva/lib/Shape';
	import WallsDoorsLayer from './WallsDoorsLayer.svelte';
	import CommentsLayer from './CommentsLayer.svelte';
	import { isPlacementMode, getComments, isCommentsVisible } from '#lib/stores/comments.svelte.ts';
	import {
		getMinEdgeDistance,
		getOverlappingItems,
		getItemShapePoints,
		getRotatedBoundingBox,
		selectNearestByDistance,
		hasArchitecturalCollision,
		rotateAroundCenter,
		type BoundingBox
	} from '#lib/utils/geometry.ts';
	import { computeSnap, type SnapGuide } from '#lib/utils/snapping.ts';
	import { getFloorplanAnalysis, isWallsDoorsVisible } from '#lib/stores/project.svelte.ts';
	import {
		buildDimensionMap,
		buildIdMap,
		getCanvasLabelFontSizes,
		getItemShadowStyle,
		getVisibleGridStep,
		resolveItemDisplayPosition,
		shouldEnableItemLayerListening,
		shouldShowDistanceIndicators,
		shouldRenderItemLabels
	} from '#lib/utils/canvas-performance.ts';
	import {
		applyCoalescedPanAndZoom,
		clampZoom,
		clientToContainer,
		getViewportCenterWorld,
		zoomTowardPoint
	} from '#lib/utils/canvas-math.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Lock from '@lucide/svelte/icons/lock';
	import Unlock from '@lucide/svelte/icons/unlock';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import MapPinOff from '@lucide/svelte/icons/map-pin-off';
	import * as m from '#lib/paraglide/messages.js';
	import { formatDimension, formatDecimal } from '#lib/utils/format.ts';

	interface Props {
		floorplan: Floorplan | null;
		items: Item[];
		selectedItemId: string | null;
		gridSize: number;
		showGrid: boolean;
		snapToGrid: boolean;
		mobileMode?: boolean;
		onItemSelect: (id: string | null) => void;
		onItemMove: (id: string, x: number, y: number) => void;
		onItemRotate: (id: string, rotation: number, position: { x: number; y: number }) => void;
		onItemUnplace: (id: string) => void;
		onThumbnailReady?: (dataUrl: string) => void;
		onCommentPlace?: (x: number, y: number) => void;
		onCommentMove?: (commentId: string, x: number, y: number) => void;
	}

	let {
		floorplan,
		items,
		selectedItemId,
		gridSize = 50,
		showGrid = true,
		snapToGrid = true,
		mobileMode = false,
		onItemSelect,
		onItemMove,
		onItemRotate,
		onItemUnplace,
		onThumbnailReady,
		onCommentPlace,
		onCommentMove
	}: Props = $props();

	let containerEl: HTMLDivElement;
	let stageRef: { node: Konva.Stage } | undefined = $state();
	let stageWidth = $state(800);
	let stageHeight = $state(600);
	let floorplanImage: HTMLImageElement | null = $state(null);
	let imageNaturalWidth = $state(0);
	let imageNaturalHeight = $state(0);

	// Zoom and pan state
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = false;
	let lastPanPoint: { x: number; y: number } | null = null;
	let zoomLocked = $state(false);
	let isInteractionActive = $state(false);

	// Coalesced interaction state (applied once per animation frame)
	let pendingPanDeltaX = 0;
	let pendingPanDeltaY = 0;
	let pendingWheelSteps = 0;
	let pendingWheelAnchorX: number | null = null;
	let pendingWheelAnchorY: number | null = null;
	let pendingPinchScale = 1;
	let pendingPinchAnchorX: number | null = null;
	let pendingPinchAnchorY: number | null = null;
	let interactionFrameId: number | null = null;

	// Touch gesture state (handler-only, not reactive)
	let pointers = new Map<number, { x: number; y: number }>();
	let lastPinchDistance = 0;
	let lastPinchCenter: { x: number; y: number } | null = null;
	let isPinching = false;

	// Long-press state for mobile item dragging
	let longPressTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let longPressItemId = $state<string | null>(null);
	let isLongPressDragging = $state(false);
	let longPressStartPoint = $state<{ x: number; y: number } | null>(null);
	let longPressGrabOffset: { x: number; y: number } | null = null;
	const LONG_PRESS_DURATION = 300; // ms
	const LONG_PRESS_MOVE_THRESHOLD = 10; // px - cancel if finger moves too much

	// Clean up long-press timer on component unmount
	$effect(() => {
		return () => {
			if (longPressTimer) {
				clearTimeout(longPressTimer);
			}
			if (interactionFrameId !== null) {
				cancelAnimationFrame(interactionFrameId);
			}
			if (interactionIdleTimeout) {
				clearTimeout(interactionIdleTimeout);
			}
			if (thumbnailTimeout) {
				clearTimeout(thumbnailTimeout);
			}
		};
	});

	// Alignment guides state
	let alignmentGuides = $state<SnapGuide[]>([]);
	let draggingItemId = $state<string | null>(null);
	let dragPosition = $state<{ x: number; y: number } | null>(null);

	// Context menu state
	let contextMenuOpen = $state(false);
	let contextMenuItemId = $state<string | null>(null);
	let contextMenuPosition = $state({ x: 0, y: 0 });

	const MIN_ZOOM = 0.5;
	const MAX_ZOOM = 5;
	const ZOOM_STEP = 0.1;
	const ZOOM_BUTTON_FACTOR = 1.25;
	const ALIGNMENT_THRESHOLD = 6; // screen pixels
	const FALLBACK_SCALE = 2; // px per cm when the floorplan is not calibrated
	const NUDGE_CM = 1;
	const NUDGE_LARGE_CM = 10;

	// Distance indicator constants
	const MAX_DISTANCE_CM = 400; // 4 meters
	const MAX_NEIGHBORS = 2;
	const END_CAP_LENGTH = 8; // pixels
	const INTERACTION_IDLE_MS = 120;

	// Label font sizes respect browser root font settings for accessibility.
	let rootFontPx = $state(16);

	$effect(() => {
		if (typeof window === 'undefined') return;

		const updateRootFontPx = () => {
			const value = parseFloat(getComputedStyle(document.documentElement).fontSize);
			if (Number.isFinite(value) && value > 0) {
				rootFontPx = value;
			}
		};

		updateRootFontPx();
		window.addEventListener('resize', updateRootFontPx);
		return () => window.removeEventListener('resize', updateRootFontPx);
	});

	const labelFontSizes = $derived(
		getCanvasLabelFontSizes({
			rootFontPx,
			mobileMode,
			zoom
		})
	);
	// World-space labels should scale naturally with stage zoom.
	const itemNameFontSize = $derived(labelFontSizes.itemNamePx);
	const itemDimensionsFontSize = $derived(labelFontSizes.itemDimensionsPx);
	// HUD labels compensate for stage zoom to remain constant on screen.
	const distanceLabelFontSize = $derived(labelFontSizes.distanceLabelPx);

	// Load floorplan image
	$effect(() => {
		if (floorplan?.imageData) {
			const img = new Image();
			img.onload = () => {
				imageNaturalWidth = img.naturalWidth;
				imageNaturalHeight = img.naturalHeight;
				floorplanImage = img;
			};
			img.src = floorplan.imageData;
		} else {
			floorplanImage = null;
			imageNaturalWidth = 0;
			imageNaturalHeight = 0;
		}
	});

	// Calculate image dimensions maintaining aspect ratio
	const imageDimensions = $derived.by(() => {
		if (!imageNaturalWidth || !imageNaturalHeight) {
			return { width: stageWidth, height: stageHeight, x: 0, y: 0 };
		}

		const imageAspect = imageNaturalWidth / imageNaturalHeight;
		const stageAspect = stageWidth / stageHeight;

		let width: number;
		let height: number;

		if (imageAspect > stageAspect) {
			width = stageWidth;
			height = stageWidth / imageAspect;
		} else {
			height = stageHeight;
			width = stageHeight * imageAspect;
		}

		const x = (stageWidth - width) / 2;
		const y = (stageHeight - height) / 2;

		return { width, height, x, y };
	});

	// Resize observer
	$effect(() => {
		if (containerEl) {
			const observer = new ResizeObserver((entries) => {
				const { width, height } = entries[0].contentRect;
				stageWidth = width;
				stageHeight = height;
			});
			observer.observe(containerEl);
			return () => observer.disconnect();
		}
	});

	function handleStageClick(e: { target: Konva.Node }) {
		if (isPlacementMode()) {
			const stage = stageRef?.node;
			if (!stage) return;
			const pointer = stage.getPointerPosition();
			if (!pointer) return;
			// Convert screen pointer to canvas coordinates (undo zoom+pan)
			const canvasX = (pointer.x - panX) / zoom;
			const canvasY = (pointer.y - panY) / zoom;
			// Convert display coords to natural coords for storage
			const natural = displayToNatural(canvasX, canvasY);
			onCommentPlace?.(natural.x, natural.y);
			return;
		}
		if (e.target.getClassName() === 'Stage') {
			onItemSelect(null);
		}
	}

	function snapDragPosition(
		itemId: string,
		x: number,
		y: number,
		free = false
	): { x: number; y: number } {
		const item = itemsById.get(itemId);
		const dimensions = itemDimensionsPxById.get(itemId);
		if (free || !item || !dimensions) {
			alignmentGuides = [];
			return { x, y };
		}

		const others: BoundingBox[] = [];
		for (const [id, box] of displayBoxesById) {
			if (id !== itemId) others.push(box);
		}

		const snap = computeSnap({
			box: getRotatedBoundingBox(x, y, dimensions.widthPx, dimensions.heightPx, item.rotation),
			others,
			threshold: ALIGNMENT_THRESHOLD / zoom,
			grid:
				snapToGrid && gridStepPx > 0
					? { originX: imageDimensions.x, originY: imageDimensions.y, step: gridStepPx }
					: null
		});

		alignmentGuides = snap.guides;
		return { x: x + snap.dx, y: y + snap.dy };
	}

	function endDrag() {
		draggingItemId = null;
		dragPosition = null;
		alignmentGuides = [];
	}

	function handleDragStart(itemId: string) {
		draggingItemId = itemId;
		if (selectedItemId !== itemId) onItemSelect(itemId);
	}

	function handleDragMove(itemId: string, e: { target: Konva.Node; evt?: Event }) {
		const node = e.target;
		const free = (e.evt as MouseEvent | undefined)?.altKey === true;
		const snapped = snapDragPosition(itemId, node.x(), node.y(), free);
		node.position(snapped);
		dragPosition = snapped;
	}

	function handleDragEnd(itemId: string, e: { target: Konva.Node }) {
		const node = e.target;
		const natural = displayToNatural(node.x(), node.y());
		onItemMove(itemId, natural.x, natural.y);
		endDrag();
	}

	function rotateItem(itemId: string, delta: number) {
		const item = itemsById.get(itemId);
		if (!item?.position) return;
		const rotation = (((item.rotation + delta) % 360) + 360) % 360;
		const position = rotateAroundCenter(
			item.position.x,
			item.position.y,
			item.width * naturalScale,
			item.height * naturalScale,
			item.rotation,
			rotation
		);
		onItemRotate(itemId, rotation, {
			x: roundCoordinate(position.x),
			y: roundCoordinate(position.y)
		});
	}

	function handleRotate(itemId: string, direction: 'cw' | 'ccw') {
		rotateItem(itemId, direction === 'cw' ? 90 : -90);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (mobileMode || !selectedItemId || e.ctrlKey || e.metaKey || e.altKey) return;
		// Only when focus is not in a form field, dialog or other widget
		const target = e.target as Node | null;
		if (target !== document.body && !(target && containerEl?.contains(target))) return;

		const item = itemsById.get(selectedItemId);
		if (!item?.position) return;

		if (e.key === 'r' || e.key === 'R') {
			e.preventDefault();
			rotateItem(item.id, e.shiftKey ? -90 : 90);
			return;
		}
		if (e.key === 'Escape') {
			onItemSelect(null);
			return;
		}

		const step = (e.shiftKey ? NUDGE_LARGE_CM : NUDGE_CM) * naturalScale;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		const move = moves[e.key];
		if (!move) return;
		e.preventDefault();
		onItemMove(item.id, item.position.x + move[0], item.position.y + move[1]);
	}

	function handleStageContextMenu(e: { evt: MouseEvent; target: Konva.Node }) {
		if (mobileMode) return;
		e.evt.preventDefault();
		// Find the item that was right-clicked by walking up the Konva tree
		let node: Konva.Node | null = e.target;
		while (node && node.getClassName() !== 'Stage') {
			const name: string = node.name() ?? '';
			if (name.startsWith('item-')) {
				const itemId = name.slice(5);
				contextMenuItemId = itemId;
				contextMenuPosition = { x: e.evt.clientX, y: e.evt.clientY };
				contextMenuOpen = true;
				onItemSelect(itemId);
				return;
			}
			node = node.getParent();
		}
		// Right-clicked on background — close any open menu
		contextMenuOpen = false;
	}

	function handleContextMenuAction(action: 'rotate-cw' | 'rotate-ccw' | 'unplace') {
		if (!contextMenuItemId) return;

		switch (action) {
			case 'rotate-cw':
				handleRotate(contextMenuItemId, 'cw');
				break;
			case 'rotate-ccw':
				handleRotate(contextMenuItemId, 'ccw');
				break;
			case 'unplace':
				onItemUnplace(contextMenuItemId);
				break;
		}
		contextMenuOpen = false;
	}

	// Close context menu on Escape
	$effect(() => {
		if (contextMenuOpen) {
			function handleKeydown(e: KeyboardEvent) {
				if (e.key === 'Escape') {
					contextMenuOpen = false;
				}
			}
			document.addEventListener('keydown', handleKeydown);
			return () => document.removeEventListener('keydown', handleKeydown);
		}
	});

	// Zoom functions
	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		if (zoomLocked) return;

		const stage = stageRef?.node;
		if (!stage) return;

		const pointer = stage.getPointerPosition();
		if (!pointer) return;

		// Normalize so mouse wheels step evenly and trackpads zoom smoothly
		const delta = -e.deltaY * (e.deltaMode === 1 ? 33 : 1);
		pendingWheelSteps += Math.max(-1, Math.min(1, delta / 100)) * (e.ctrlKey ? 4 : 1);
		pendingWheelAnchorX = pointer.x;
		pendingWheelAnchorY = pointer.y;
		markInteractionActive();
		scheduleInteractionFrame();
	}

	function zoomByFactor(factor: number) {
		const result = zoomTowardPoint({
			anchorX: stageWidth / 2,
			anchorY: stageHeight / 2,
			oldZoom: zoom,
			newZoom: clampZoom(zoom * factor, MIN_ZOOM, MAX_ZOOM),
			panX,
			panY
		});
		zoom = result.zoom;
		panX = result.panX;
		panY = result.panY;
	}

	function zoomIn() {
		zoomByFactor(ZOOM_BUTTON_FACTOR);
	}

	function zoomOut() {
		zoomByFactor(1 / ZOOM_BUTTON_FACTOR);
	}

	function resetView() {
		zoom = 1;
		panX = 0;
		panY = 0;
	}

	function handlePointerDown(e: PointerEvent) {
		// Don't interfere with item dragging on desktop
		if (e.pointerType === 'mouse') return;

		const stage = stageRef?.node;
		if (!stage) return;

		const rect = containerEl.getBoundingClientRect();
		const point = clientToContainer(e.clientX, e.clientY, rect);
		pointers.set(e.pointerId, point);

		// If we now have 2 pointers, start pinch
		if (pointers.size === 2) {
			isPinching = true;
			isPanning = false;
			cancelLongPress();

			const [p1, p2] = Array.from(pointers.values());
			const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
			lastPinchDistance = distance;
			lastPinchCenter = {
				x: (p1.x + p2.x) / 2,
				y: (p1.y + p2.y) / 2
			};
		} else if (pointers.size === 1 && mobileMode) {
			// Check if touch landed on an item - start long-press timer
			const stageNode = stageRef?.node;
			if (stageNode) {
				const pos = stageNode.getPointerPosition();
				if (pos) {
					const shape = stageNode.getIntersection(pos);
					if (shape) {
						// Walk up to find the Group (item container)
						let node: Konva.Node | null = shape;
						while (node && node.getClassName() !== 'Group') {
							node = node.parent;
						}
						if (node && node.getClassName() === 'Group') {
							// Extract item ID from the Group's name attribute (set as "item-{id}")
							const groupName = node.name();
							if (groupName?.startsWith('item-')) {
								const itemId = groupName.slice(5);
								startLongPressTimer(itemId, point.x, point.y);
							}
						}
					}
				}
			}
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (e.pointerType === 'mouse') return;

		const stage = stageRef?.node;
		if (!stage) return;

		// Update pointer position
		const currentPointer = pointers.get(e.pointerId);
		if (!currentPointer) return;

		const rect = containerEl.getBoundingClientRect();
		pointers.set(e.pointerId, clientToContainer(e.clientX, e.clientY, rect));

		// Handle pinch zoom with 2 fingers
		if (pointers.size === 2 && isPinching) {
			e.preventDefault();
			markInteractionActive();

			const [p1, p2] = Array.from(pointers.values());
			const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
			const center = {
				x: (p1.x + p2.x) / 2,
				y: (p1.y + p2.y) / 2
			};

			if (lastPinchDistance > 0 && lastPinchCenter) {
				pendingPinchScale *= distance / lastPinchDistance;
				pendingPinchAnchorX = lastPinchCenter.x;
				pendingPinchAnchorY = lastPinchCenter.y;
			}

			lastPinchDistance = distance;
			lastPinchCenter = center;
			scheduleInteractionFrame();
		} else if (pointers.size === 1 && !isPinching) {
			// Check if long-press should be cancelled (finger moved too far before triggering)
			if (longPressStartPoint && !isLongPressDragging) {
				const currentPoint = Array.from(pointers.values())[0];
				const dx = currentPoint.x - longPressStartPoint.x;
				const dy = currentPoint.y - longPressStartPoint.y;
				if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD) {
					cancelLongPress();
				}
			}

			if (isLongPressDragging && longPressItemId) {
				markInteractionActive();
				// Move item with finger, keeping the point where it was grabbed
				const point = Array.from(pointers.values())[0];
				const offset = longPressGrabOffset ?? { x: 0, y: 0 };
				dragPosition = snapDragPosition(
					longPressItemId,
					(point.x - panX) / zoom - offset.x,
					(point.y - panY) / zoom - offset.y
				);
			} else if (!mobileMode || !longPressStartPoint) {
				// Pan (only when not in long-press detection on mobile)
				const isDraggingItem = draggingItemId !== null;
				if (!isDraggingItem) {
					markInteractionActive();
					const currentPoint = Array.from(pointers.values())[0];
					if (lastPanPoint) {
						pendingPanDeltaX += currentPoint.x - lastPanPoint.x;
						pendingPanDeltaY += currentPoint.y - lastPanPoint.y;
					}
					lastPanPoint = currentPoint;
					scheduleInteractionFrame();
				}
			}
		}
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.pointerType === 'mouse') return;

		pointers.delete(e.pointerId);

		// End long-press drag
		if (isLongPressDragging) {
			endLongPressDrag();
		}
		cancelLongPress();

		// Reset pinch state if we no longer have 2 fingers
		if (pointers.size < 2) {
			isPinching = false;
			lastPinchDistance = 0;
			lastPinchCenter = null;
		}

		// Reset pan state if no fingers
		if (pointers.size === 0) {
			lastPanPoint = null;
		}
	}

	function startLongPressTimer(itemId: string, x: number, y: number) {
		cancelLongPress();
		longPressStartPoint = { x, y };
		const item = itemsById.get(itemId);
		if (item?.position) {
			const display = naturalToDisplay(item.position.x, item.position.y);
			longPressGrabOffset = {
				x: (x - panX) / zoom - display.x,
				y: (y - panY) / zoom - display.y
			};
		} else {
			longPressGrabOffset = null;
		}
		longPressTimer = setTimeout(() => {
			longPressItemId = itemId;
			isLongPressDragging = true;
			draggingItemId = itemId; // Enable distance indicators during drag
			// Haptic feedback if available
			if (navigator.vibrate) navigator.vibrate(50);
		}, LONG_PRESS_DURATION);
	}

	function cancelLongPress() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		longPressStartPoint = null;
	}

	function endLongPressDrag() {
		if (longPressItemId && dragPosition) {
			const natural = displayToNatural(dragPosition.x, dragPosition.y);
			onItemMove(longPressItemId, natural.x, natural.y);
		}
		isLongPressDragging = false;
		longPressItemId = null;
		longPressGrabOffset = null;
		endDrag();
		cancelLongPress();
	}

	// Pan functions
	function handleMouseDown(e: { evt: MouseEvent; target: Konva.Node }) {
		// Only pan if clicking on stage background or image (not on furniture items)
		if (e.evt.button !== 0 && e.evt.button !== 1) return;
		if (e.target.getClassName() === 'Stage' || e.evt.button === 1) {
			isPanning = true;
			lastPanPoint = { x: e.evt.clientX, y: e.evt.clientY };
			// Change cursor to grabbing
			if (containerEl) containerEl.style.cursor = 'grabbing';
		}
	}

	function handleMouseMove(e: { evt: MouseEvent }) {
		if (!isPanning || !lastPanPoint) return;

		const dx = e.evt.clientX - lastPanPoint.x;
		const dy = e.evt.clientY - lastPanPoint.y;

		pendingPanDeltaX += dx;
		pendingPanDeltaY += dy;
		lastPanPoint = { x: e.evt.clientX, y: e.evt.clientY };
		markInteractionActive();
		scheduleInteractionFrame();
	}

	function handleMouseUp() {
		isPanning = false;
		lastPanPoint = null;
		if (containerEl) containerEl.style.cursor = 'default';
	}

	function markInteractionActive() {
		isInteractionActive = true;
		if (interactionIdleTimeout) {
			clearTimeout(interactionIdleTimeout);
		}
		interactionIdleTimeout = setTimeout(() => {
			isInteractionActive = false;
			interactionIdleTimeout = null;
		}, INTERACTION_IDLE_MS);
	}

	function scheduleInteractionFrame() {
		if (interactionFrameId !== null) return;

		interactionFrameId = requestAnimationFrame(() => {
			interactionFrameId = null;

			// Apply coalesced pan + wheel zoom
			const next = applyCoalescedPanAndZoom({
				zoom,
				panX,
				panY,
				panDeltaX: pendingPanDeltaX,
				panDeltaY: pendingPanDeltaY,
				wheelSteps: pendingWheelSteps,
				wheelAnchorX: pendingWheelAnchorX,
				wheelAnchorY: pendingWheelAnchorY,
				zoomStep: ZOOM_STEP,
				minZoom: MIN_ZOOM,
				maxZoom: MAX_ZOOM
			});

			// Apply coalesced pinch zoom
			if (pendingPinchScale !== 1 && pendingPinchAnchorX !== null && pendingPinchAnchorY !== null) {
				const pinched = zoomTowardPoint({
					anchorX: pendingPinchAnchorX,
					anchorY: pendingPinchAnchorY,
					oldZoom: next.zoom,
					newZoom: clampZoom(next.zoom * pendingPinchScale, MIN_ZOOM, MAX_ZOOM),
					panX: next.panX,
					panY: next.panY
				});
				next.zoom = pinched.zoom;
				next.panX = pinched.panX;
				next.panY = pinched.panY;
			}

			zoom = next.zoom;
			panX = next.panX;
			panY = next.panY;

			pendingPanDeltaX = 0;
			pendingPanDeltaY = 0;
			pendingWheelSteps = 0;
			pendingWheelAnchorX = null;
			pendingWheelAnchorY = null;
			pendingPinchScale = 1;
			pendingPinchAnchorX = null;
			pendingPinchAnchorY = null;
		});
	}

	// Calculate the display scale (ratio of display size to natural image size)
	const displayScale = $derived.by(() => {
		if (!imageNaturalWidth || !imageDimensions.width) return 1;
		return imageDimensions.width / imageNaturalWidth;
	});

	// Convert display coordinates to natural image coordinates for storage
	// This makes positions screen-size independent
	function displayToNatural(displayX: number, displayY: number): { x: number; y: number } {
		return {
			x: roundCoordinate((displayX - imageDimensions.x) / displayScale),
			y: roundCoordinate((displayY - imageDimensions.y) / displayScale)
		};
	}

	// Stored coordinates keep two decimals; avoids float noise like 199.99999999999997
	function roundCoordinate(value: number): number {
		return Math.round(value * 100) / 100;
	}

	export function getViewportCenterNatural(): { x: number; y: number } {
		const worldCenter = getViewportCenterWorld(stageWidth, stageHeight, zoom, panX, panY);
		const natural = displayToNatural(worldCenter.x, worldCenter.y);
		return {
			x: Math.round(natural.x),
			y: Math.round(natural.y)
		};
	}

	// Convert natural image coordinates to display coordinates for rendering
	function naturalToDisplay(naturalX: number, naturalY: number): { x: number; y: number } {
		return {
			x: naturalX * displayScale + imageDimensions.x,
			y: naturalY * displayScale + imageDimensions.y
		};
	}

	// Pixels per cm in natural image coordinates and in display coordinates
	const naturalScale = $derived(floorplan?.scale || FALLBACK_SCALE);
	const effectiveScale = $derived(naturalScale * displayScale);
	// Grid size is in cm, anchored at the floorplan image origin
	const gridStepPx = $derived(Math.max(0, gridSize) * effectiveScale);
	const itemShadowStyle = $derived(getItemShadowStyle(isInteractionActive));
	const itemShadowsEnabled = $derived(itemShadowStyle.opacity > 0);
	const itemLayerListening = $derived.by(() =>
		shouldEnableItemLayerListening({
			isInteractionActive,
			isDraggingItem: draggingItemId !== null,
			isLongPressDragging
		})
	);

	function drawGridScene(context: Context, shape: KonvaShape) {
		const stage = shape.getStage();
		if (!stage) return;
		const scale = stage.scaleX() || 1;
		const step = getVisibleGridStep(gridStepPx, scale);
		if (step <= 0) return;

		const left = -stage.x() / scale;
		const top = -stage.y() / scale;
		const right = left + stage.width() / scale;
		const bottom = top + stage.height() / scale;
		const originX = imageDimensions.x;
		const originY = imageDimensions.y;

		context.beginPath();
		for (let x = originX + Math.ceil((left - originX) / step) * step; x <= right; x += step) {
			context.moveTo(x, top);
			context.lineTo(x, bottom);
		}
		for (let y = originY + Math.ceil((top - originY) / step) * step; y <= bottom; y += step) {
			context.moveTo(left, y);
			context.lineTo(right, y);
		}
		context.strokeShape(shape);
	}

	// The grid is drawn imperatively, so redraw when its inputs change
	$effect(() => {
		void [gridStepPx, imageDimensions];
		stageRef?.node.batchDraw();
	});

	const placedItems = $derived(items.filter((i) => i.position !== null));
	const itemsById = $derived.by(() => buildIdMap(items));
	const itemDimensionsPxById = $derived.by(() => buildDimensionMap(items, effectiveScale));

	const displayBoxesById = $derived.by(() => {
		const boxes = new Map<string, BoundingBox>();
		for (const item of placedItems) {
			const display = naturalToDisplay(item.position!.x, item.position!.y);
			boxes.set(
				item.id,
				getRotatedBoundingBox(
					display.x,
					display.y,
					item.width * effectiveScale,
					item.height * effectiveScale,
					item.rotation
				)
			);
		}
		return boxes;
	});

	const itemCommentCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const comment of getComments()) {
			if (comment.type !== 'item' || !comment.itemId || comment.resolved) continue;
			counts.set(comment.itemId, (counts.get(comment.itemId) ?? 0) + 1);
		}
		return counts;
	});

	// Natural position of the item being dragged, while it is being dragged
	const liveDragNatural = $derived(
		draggingItemId && dragPosition ? displayToNatural(dragPosition.x, dragPosition.y) : null
	);

	// Overlap detection in natural coordinates, live during drags
	const overlappingIds = $derived.by(() => {
		const live = liveDragNatural;
		if (!live) return getOverlappingItems(items, naturalScale);
		return getOverlappingItems(
			items.map((item) => (item.id === draggingItemId ? { ...item, position: live } : item)),
			naturalScale
		);
	});

	// Walls, doors and windows blocked by the dragged or selected item
	const architecturalCollisionItemId = $derived.by(() => {
		if (!isWallsDoorsVisible()) return null;
		const activeId = draggingItemId ?? selectedItemId;
		if (!activeId) return null;
		const item = itemsById.get(activeId);
		const position = (activeId === draggingItemId ? liveDragNatural : null) ?? item?.position;
		if (!item || !position) return null;

		const analysis = getFloorplanAnalysis();
		const box = getRotatedBoundingBox(
			position.x,
			position.y,
			item.width * naturalScale,
			item.height * naturalScale,
			item.rotation
		);
		return hasArchitecturalCollision(
			box.minX,
			box.minY,
			box.maxX - box.minX,
			box.maxY - box.minY,
			analysis.walls,
			analysis.doors,
			analysis.windows
		)
			? activeId
			: null;
	});

	// Distance indicators - show distances to 2 nearest items within 4m
	const distanceIndicators = $derived.by(() => {
		if (
			!shouldShowDistanceIndicators({
				isInteractionActive,
				isDraggingItem: draggingItemId !== null
			})
		) {
			return [];
		}

		// Get the active item (selected or being dragged)
		const activeItemId = draggingItemId ?? selectedItemId;
		if (!activeItemId || !floorplan?.scale) return [];

		const activeItem = itemsById.get(activeItemId);
		if (!activeItem?.position) return [];

		// Convert active item to display coordinates
		// Use live drag position if dragging, otherwise use stored position
		const activeDisplayPos =
			draggingItemId && dragPosition
				? dragPosition
				: naturalToDisplay(activeItem.position.x, activeItem.position.y);
		const activeDimensions = itemDimensionsPxById.get(activeItem.id);
		if (!activeDimensions) return [];
		const activeWidthPx = activeDimensions.widthPx;
		const activeHeightPx = activeDimensions.heightPx;
		const activeBox = getRotatedBoundingBox(
			activeDisplayPos.x,
			activeDisplayPos.y,
			activeWidthPx,
			activeHeightPx,
			activeItem.rotation
		);

		const candidates: Array<{
			item: Item;
			distance: number;
			distanceCm: number;
			pointA: { x: number; y: number };
			pointB: { x: number; y: number };
		}> = [];

		for (const item of placedItems) {
			if (item.id === activeItemId) continue;
			const itemBox = displayBoxesById.get(item.id);
			if (!itemBox) continue;
			// A gap measurement is meaningless for items that already overlap
			if (
				itemBox.minX < activeBox.maxX &&
				itemBox.maxX > activeBox.minX &&
				itemBox.minY < activeBox.maxY &&
				itemBox.maxY > activeBox.minY
			)
				continue;

			const { distance, pointA, pointB } = getMinEdgeDistance(activeBox, itemBox);
			const distanceCm = distance / effectiveScale;
			if (distanceCm > MAX_DISTANCE_CM) continue;

			candidates.push({
				item,
				distance,
				distanceCm,
				pointA,
				pointB
			});
		}

		return selectNearestByDistance(candidates, MAX_NEIGHBORS);
	});

	// Thumbnail generation - debounced after changes
	let thumbnailTimeout: ReturnType<typeof setTimeout> | null = null;
	let interactionIdleTimeout: ReturnType<typeof setTimeout> | null = null;

	function generateThumbnail() {
		const stage = stageRef?.node;
		if (!stage || !onThumbnailReady) return;
		if (!stage.width() || !stage.height()) return;

		// Reset view temporarily for consistent thumbnail
		const originalScale = { x: stage.scaleX(), y: stage.scaleY() };
		const originalPos = { x: stage.x(), y: stage.y() };

		stage.scale({ x: 1, y: 1 });
		stage.position({ x: 0, y: 0 });

		let dataUrl: string;
		try {
			dataUrl = stage.toDataURL({ pixelRatio: 0.5 });
		} catch {
			stage.scale(originalScale);
			stage.position(originalPos);
			return;
		}

		// Restore view
		stage.scale(originalScale);
		stage.position(originalPos);

		onThumbnailReady(dataUrl);
	}

	function debounceThumbnail() {
		if (!onThumbnailReady) return;
		if (thumbnailTimeout) clearTimeout(thumbnailTimeout);
		thumbnailTimeout = setTimeout(generateThumbnail, 2000);
	}

	const thumbnailSignature = $derived.by(() =>
		placedItems
			.map((item) => {
				const position = item.position;
				return [
					item.id,
					item.name,
					item.shape,
					item.width,
					item.height,
					item.cutoutWidth ?? '',
					item.cutoutHeight ?? '',
					item.cutoutCorner ?? '',
					item.rotation,
					item.color,
					position ? position.x : '',
					position ? position.y : ''
				].join(':');
			})
			.join('|')
	);

	// Generate thumbnail when items or floorplan changes
	$effect(() => {
		// Track dependencies
		const _ = [thumbnailSignature, floorplanImage, stageWidth, stageHeight];
		debounceThumbnail();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	bind:this={containerEl}
	role="application"
	class="w-full h-full bg-canvas-bg relative"
	onwheel={handleWheel}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerUp}
	style="touch-action: none;"
>
	<Stage
		bind:this={stageRef}
		width={stageWidth}
		height={stageHeight}
		scaleX={zoom}
		scaleY={zoom}
		x={panX}
		y={panY}
		onpointerclick={handleStageClick}
		oncontextmenu={handleStageContextMenu}
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
	>
		<Layer listening={false}>
			<!-- Floorplan image -->
			{#if floorplanImage}
				<KonvaImage
					image={floorplanImage}
					x={imageDimensions.x}
					y={imageDimensions.y}
					width={imageDimensions.width}
					height={imageDimensions.height}
					opacity={0.8}
				/>
			{/if}

			<!-- Grid -->
			{#if showGrid}
				<Shape
					listening={false}
					stroke="rgba(100,116,139,0.45)"
					strokeWidth={1}
					strokeScaleEnabled={false}
					sceneFunc={drawGridScene}
				/>
			{/if}

			<!-- Walls & Doors Layer (AI-extracted architectural elements) -->
			<Group
				x={imageDimensions.x}
				y={imageDimensions.y}
				scaleX={displayScale}
				scaleY={displayScale}
				listening={false}
			>
				<WallsDoorsLayer />
			</Group>
		</Layer>

		<Layer listening={itemLayerListening}>
			<!-- Furniture items -->
			{#each placedItems as item (item.id)}
				{@const isOverlapping = overlappingIds.has(item.id)}
				{@const hasArchCollision = architecturalCollisionItemId === item.id}
				{@const itemDimensions = itemDimensionsPxById.get(item.id)}
				{@const itemWidthPx = itemDimensions?.widthPx ?? item.width * effectiveScale}
				{@const itemHeightPx = itemDimensions?.heightPx ?? item.height * effectiveScale}
				{@const showStroke =
					longPressItemId === item.id ||
					selectedItemId === item.id ||
					isOverlapping ||
					hasArchCollision}
				{@const strokeColor =
					longPressItemId === item.id
						? '#3B82F6'
						: selectedItemId === item.id
							? '#60A5FA'
							: hasArchCollision
								? '#EA580C'
								: '#DC2626'}
				{@const strokeWidth = longPressItemId === item.id ? 3 : 2}
				{@const displayPos = resolveItemDisplayPosition({
					itemId: item.id,
					naturalX: item.position!.x,
					naturalY: item.position!.y,
					draggingItemId,
					dragPosition,
					naturalToDisplay
				})}
				{@const quarterTurns = Math.round(item.rotation / 90)}
				{@const labelWidthPx = quarterTurns % 2 !== 0 ? itemHeightPx : itemWidthPx}
				{@const labelHeightPx = quarterTurns % 2 !== 0 ? itemWidthPx : itemHeightPx}
				{@const renderLabels = shouldRenderItemLabels({
					isInteractionActive,
					isSelected: selectedItemId === item.id,
					isDragging: draggingItemId === item.id || longPressItemId === item.id,
					itemWidthPx: labelWidthPx,
					itemHeightPx: labelHeightPx,
					itemNameFontPx: itemNameFontSize
				})}
				<Group
					x={displayPos.x}
					y={displayPos.y}
					rotation={item.rotation}
					draggable={!mobileMode && itemLayerListening}
					name={`item-${item.id}`}
					onpointerclick={() => onItemSelect(item.id)}
					ondragstart={mobileMode ? undefined : () => handleDragStart(item.id)}
					ondragmove={mobileMode ? undefined : (e) => handleDragMove(item.id, e)}
					ondragend={mobileMode ? undefined : (e) => handleDragEnd(item.id, e)}
					onmouseenter={mobileMode
						? undefined
						: (e: { target: Konva.Node }) => {
								const s = e.target.getStage();
								if (s) s.container().style.cursor = 'pointer';
							}}
					onmouseleave={mobileMode
						? undefined
						: (e: { target: Konva.Node }) => {
								const s = e.target.getStage();
								if (s) s.container().style.cursor = 'default';
							}}
				>
					{#if item.shape === 'l-shape'}
						<Line
							points={getItemShapePoints(item, effectiveScale)}
							closed={true}
							fill={hasArchCollision ? '#FB923C' : isOverlapping ? '#F87171' : item.color}
							opacity={hasArchCollision || isOverlapping ? 0.7 : 1}
							shadowColor="black"
							shadowBlur={itemShadowStyle.blur}
							shadowOpacity={itemShadowStyle.opacity}
							shadowOffsetX={itemShadowStyle.offsetX}
							shadowOffsetY={itemShadowStyle.offsetY}
							shadowEnabled={itemShadowsEnabled}
							perfectDrawEnabled={false}
							stroke={strokeColor}
							strokeEnabled={showStroke}
							{strokeWidth}
						/>
					{:else}
						<Rect
							width={itemWidthPx}
							height={itemHeightPx}
							fill={hasArchCollision ? '#FB923C' : isOverlapping ? '#F87171' : item.color}
							opacity={hasArchCollision || isOverlapping ? 0.7 : 1}
							shadowColor="black"
							shadowBlur={itemShadowStyle.blur}
							shadowOpacity={itemShadowStyle.opacity}
							shadowOffsetX={itemShadowStyle.offsetX}
							shadowOffsetY={itemShadowStyle.offsetY}
							shadowEnabled={itemShadowsEnabled}
							perfectDrawEnabled={false}
							stroke={strokeColor}
							strokeEnabled={showStroke}
							{strokeWidth}
							cornerRadius={2}
						/>
					{/if}
					{#if renderLabels.showName || renderLabels.showDimensions}
						<!-- Labels are turned back so they stay upright on rotated items -->
						<Group
							x={itemWidthPx / 2}
							y={itemHeightPx / 2}
							rotation={-quarterTurns * 90}
							listening={false}
						>
							{#if renderLabels.showName && item.name}
								<Text
									x={-labelWidthPx / 2}
									y={-12}
									text={item.name}
									fontSize={itemNameFontSize}
									fontFamily="system-ui, sans-serif"
									fontStyle="bold"
									fill="#1e293b"
									align="center"
									width={labelWidthPx}
									wrap="none"
									ellipsis={true}
									listening={false}
								/>
							{/if}
							{#if renderLabels.showDimensions && labelWidthPx > 0}
								<Text
									x={-labelWidthPx / 2}
									y={renderLabels.showName && item.name ? 2 : -itemDimensionsFontSize / 2}
									text={formatDimension(item.width, item.height)}
									fontSize={itemDimensionsFontSize}
									fontFamily="system-ui, sans-serif"
									fill="#475569"
									align="center"
									width={labelWidthPx}
									listening={false}
								/>
							{/if}
						</Group>
					{/if}
					{@const badgeCount = itemCommentCounts.get(item.id) ?? 0}
					{#if isCommentsVisible() && badgeCount > 0}
						{@const badgeRadius = 8}
						<Circle
							x={itemWidthPx - badgeRadius / 2}
							y={-badgeRadius / 2}
							radius={badgeRadius}
							fill="#6366f1"
							stroke="#fff"
							strokeWidth={1}
							listening={false}
						/>
						<Text
							x={itemWidthPx - badgeRadius / 2 - badgeRadius}
							y={-badgeRadius / 2 - badgeRadius}
							width={badgeRadius * 2}
							height={badgeRadius * 2}
							text={String(badgeCount)}
							fontSize={10}
							fill="#fff"
							fontStyle="bold"
							align="center"
							verticalAlign="middle"
							listening={false}
						/>
					{/if}
				</Group>
			{/each}
		</Layer>

		<!-- Comments Layer -->
		<Layer listening={!isPlacementMode()}>
			<Group
				x={imageDimensions.x}
				y={imageDimensions.y}
				scaleX={displayScale}
				scaleY={displayScale}
			>
				<CommentsLayer isMobile={mobileMode} {onCommentMove} />
			</Group>
		</Layer>

		<!-- Distance indicators -->
		{#if distanceIndicators.length > 0}
			<Layer listening={false}>
				{#each distanceIndicators as indicator}
					{@const dx = indicator.pointB.x - indicator.pointA.x}
					{@const dy = indicator.pointB.y - indicator.pointA.y}
					{@const angle = Math.atan2(dy, dx)}
					{@const midX = (indicator.pointA.x + indicator.pointB.x) / 2}
					{@const midY = (indicator.pointA.y + indicator.pointB.y) / 2}
					{@const labelText = `${formatDecimal(Math.round(indicator.distanceCm), 0)} cm`}
					{@const endCapLength = END_CAP_LENGTH / zoom}

					<!-- Main dimension line -->
					<Line
						points={[
							indicator.pointA.x,
							indicator.pointA.y,
							indicator.pointB.x,
							indicator.pointB.y
						]}
						stroke="#3B82F6"
						strokeWidth={1.5 / zoom}
						listening={false}
					/>

					<!-- End cap at pointA -->
					<Line
						points={[
							indicator.pointA.x - Math.sin(angle) * endCapLength,
							indicator.pointA.y + Math.cos(angle) * endCapLength,
							indicator.pointA.x + Math.sin(angle) * endCapLength,
							indicator.pointA.y - Math.cos(angle) * endCapLength
						]}
						stroke="#3B82F6"
						strokeWidth={1.5 / zoom}
						listening={false}
					/>

					<!-- End cap at pointB -->
					<Line
						points={[
							indicator.pointB.x - Math.sin(angle) * endCapLength,
							indicator.pointB.y + Math.cos(angle) * endCapLength,
							indicator.pointB.x + Math.sin(angle) * endCapLength,
							indicator.pointB.y - Math.cos(angle) * endCapLength
						]}
						stroke="#3B82F6"
						strokeWidth={1.5 / zoom}
						listening={false}
					/>

					<!-- Distance label with background -->
					<Group x={midX} y={midY} listening={false}>
						{@const labelWidth = Math.max(50, labelText.length * 7) / zoom}
						{@const labelHeight = 20 / zoom}
						{@const labelYOffset = 10 / zoom}
						<Rect
							x={-labelWidth / 2}
							y={-labelYOffset}
							width={labelWidth}
							height={labelHeight}
							fill="white"
							cornerRadius={4 / zoom}
							shadowColor="black"
							shadowBlur={2 / zoom}
							shadowOpacity={0.2}
						/>
						<Text
							x={-labelWidth / 2}
							y={-labelYOffset}
							width={labelWidth}
							height={labelHeight}
							text={labelText}
							fontSize={distanceLabelFontSize}
							fontFamily="system-ui, sans-serif"
							fontStyle="bold"
							fill="#3B82F6"
							align="center"
							verticalAlign="middle"
						/>
					</Group>
				{/each}
			</Layer>
		{/if}

		<!-- Alignment guides -->
		{#if alignmentGuides.length > 0}
			<Layer listening={false}>
				{#each alignmentGuides as guide}
					{#if guide.type === 'v'}
						<Line
							points={[guide.pos, -10000, guide.pos, 10000]}
							stroke="#3B82F6"
							strokeWidth={1 / zoom}
							dash={[4 / zoom, 4 / zoom]}
							listening={false}
						/>
					{:else}
						<Line
							points={[-10000, guide.pos, 10000, guide.pos]}
							stroke="#3B82F6"
							strokeWidth={1 / zoom}
							dash={[4 / zoom, 4 / zoom]}
							listening={false}
						/>
					{/if}
				{/each}
			</Layer>
		{/if}
	</Stage>

	<!-- Zoom controls -->
	<div
		class="absolute top-2 right-2 flex flex-col gap-1 bg-surface-container-lowest/80 backdrop-blur-[12px] rounded-lg p-1"
	>
		<Button
			variant="ghost"
			size="icon-sm"
			class="text-on-surface-variant"
			onclick={zoomIn}
			title={m.canvas_zoom_in()}
			disabled={zoomLocked}
		>
			<Plus size={16} />
		</Button>
		<div class="text-xs text-center text-on-surface-variant py-1 font-technical">
			{Math.round(zoom * 100)}%
		</div>
		<Button
			variant="ghost"
			size="icon-sm"
			class="text-on-surface-variant"
			onclick={zoomOut}
			title={m.canvas_zoom_out()}
			disabled={zoomLocked}
		>
			<Minus size={16} />
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class="text-on-surface-variant"
			onclick={resetView}
			title={m.canvas_reset_view()}
		>
			<RefreshCw size={14} />
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class={zoomLocked ? 'text-secondary bg-secondary-fixed' : 'text-on-surface-variant'}
			onclick={() => (zoomLocked = !zoomLocked)}
			title={zoomLocked ? m.canvas_unlock_zoom() : m.canvas_lock_zoom()}
		>
			{#if zoomLocked}
				<Lock size={14} />
			{:else}
				<Unlock size={14} />
			{/if}
		</Button>
	</div>

	<!-- Scale bar -->
	{#if floorplan?.scale}
		{@const scaleBarWidth = 100 * effectiveScale * zoom}
		<div
			class="absolute top-2 left-2 flex flex-col items-start gap-0.5 bg-surface-container-lowest/80 backdrop-blur-[12px] rounded-lg px-2 py-1"
		>
			<div
				class="h-1.5 bg-on-surface-variant/40 rounded-sm"
				style="width: {Math.max(20, Math.min(200, scaleBarWidth))}px;"
			></div>
			<span class="text-xs text-on-surface-variant font-technical">{m.canvas_scale_bar()}</span>
		</div>
	{/if}

	<!-- Item context menu -->
	{#if contextMenuOpen}
		<!-- Backdrop to close menu on click outside -->
		<button
			type="button"
			class="fixed inset-0 z-40"
			onclick={() => (contextMenuOpen = false)}
			oncontextmenu={(e) => {
				e.preventDefault();
				contextMenuOpen = false;
			}}
			aria-label={m.canvas_close_menu()}
		></button>
		<div
			class="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
			style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
			role="menu"
		>
			<button
				type="button"
				class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
				onclick={() => handleContextMenuAction('rotate-ccw')}
				role="menuitem"
			>
				<RotateCcw class="mr-2 size-4" />
				{m.canvas_rotate_left()}
			</button>
			<button
				type="button"
				class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
				onclick={() => handleContextMenuAction('rotate-cw')}
				role="menuitem"
			>
				<RotateCw class="mr-2 size-4" />
				{m.canvas_rotate_right()}
			</button>
			<div class="-mx-1 my-1 h-px bg-muted"></div>
			<button
				type="button"
				class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-destructive hover:bg-destructive/10 hover:text-destructive"
				onclick={() => handleContextMenuAction('unplace')}
				role="menuitem"
			>
				<MapPinOff class="mr-2 size-4" />
				{m.canvas_remove_from_plan()}
			</button>
		</div>
	{/if}
</div>
