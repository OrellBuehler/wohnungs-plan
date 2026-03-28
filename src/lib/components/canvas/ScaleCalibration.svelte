<script lang="ts">
	import { Stage, Layer, Image as KonvaImage, Line, Circle, Text } from 'svelte-konva';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import * as m from '$lib/paraglide/messages';
	import type Konva from 'konva';

	interface Props {
		imageData: string;
		initialReferenceLength?: number;
		onCalibrate: (scale: number, referenceLength: number) => void;
		onCancel: () => void;
	}

	let { imageData, initialReferenceLength, onCalibrate, onCancel }: Props = $props();

	let containerEl: HTMLDivElement;
	let stageRef: { node: Konva.Stage } | undefined = $state();
	let stageWidth = $state(800);
	let stageHeight = $state(600);
	let image: HTMLImageElement | null = $state(null);
	let imageNaturalWidth = $state(0);
	let imageNaturalHeight = $state(0);

	let point1 = $state<{ x: number; y: number } | null>(null);
	let point2 = $state<{ x: number; y: number } | null>(null);
	let referenceLength = $state(initialReferenceLength ?? 100);

	// Zoom and pan state
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let lastPanPoint = $state<{ x: number; y: number } | null>(null);
	let mouseDownPoint = $state<{ x: number; y: number } | null>(null);
	let hasDragged = $state(false);

	// Touch gesture state
	let pointers = $state(new Map<number, { x: number; y: number }>());
	let lastPinchDistance = $state(0);
	let lastPinchCenter = $state<{ x: number; y: number } | null>(null);
	let isPinching = $state(false);
	let touchStartPoint = $state<{ x: number; y: number } | null>(null);
	let touchHasDragged = $state(false);

	const MIN_ZOOM = 0.25;
	const MAX_ZOOM = 8;
	const ZOOM_STEP = 0.1;
	const DRAG_THRESHOLD = 5; // pixels

	// Load image
	$effect(() => {
		const img = new Image();
		img.onload = () => {
			imageNaturalWidth = img.naturalWidth;
			imageNaturalHeight = img.naturalHeight;
			image = img;
		};
		img.src = imageData;
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

	const lineLength = $derived.by(() => {
		if (!point1 || !point2) return 0;
		return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
	});

	// Calculate the ratio between displayed image and natural image
	const displayToNaturalRatio = $derived.by(() => {
		if (!imageDimensions.width || !imageNaturalWidth) return 1;
		return imageNaturalWidth / imageDimensions.width;
	});

	// Scale in natural image pixels per cm (not display pixels)
	const scale = $derived.by(() => {
		if (lineLength === 0 || referenceLength <= 0) return 0;
		// Convert line length from display pixels to natural image pixels
		const naturalLineLength = lineLength * displayToNaturalRatio;
		return naturalLineLength / referenceLength;
	});

	// Convert screen coordinates to canvas coordinates
	function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
		return {
			x: (screenX - panX) / zoom,
			y: (screenY - panY) / zoom
		};
	}

	function placePoint() {
		const stage = stageRef?.node;
		if (!stage) return;

		const pointer = stage.getPointerPosition();
		if (!pointer) return;

		const canvasPos = screenToCanvas(pointer.x, pointer.y);

		if (!point1) {
			point1 = canvasPos;
		} else if (!point2) {
			point2 = canvasPos;
		} else {
			point1 = canvasPos;
			point2 = null;
		}
	}

	// Zoom functions
	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const stage = stageRef?.node;
		if (!stage) return;

		const pointer = stage.getPointerPosition();
		if (!pointer) return;

		const oldZoom = zoom;
		const newZoom =
			e.deltaY < 0 ? Math.min(MAX_ZOOM, zoom + ZOOM_STEP) : Math.max(MIN_ZOOM, zoom - ZOOM_STEP);

		const mousePointTo = {
			x: (pointer.x - panX) / oldZoom,
			y: (pointer.y - panY) / oldZoom
		};

		zoom = newZoom;
		panX = pointer.x - mousePointTo.x * newZoom;
		panY = pointer.y - mousePointTo.y * newZoom;
	}

	function zoomIn() {
		const newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP * 2);
		const centerX = stageWidth / 2;
		const centerY = stageHeight / 2;
		const mousePointTo = {
			x: (centerX - panX) / zoom,
			y: (centerY - panY) / zoom
		};
		zoom = newZoom;
		panX = centerX - mousePointTo.x * newZoom;
		panY = centerY - mousePointTo.y * newZoom;
	}

	function zoomOut() {
		const newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP * 2);
		const centerX = stageWidth / 2;
		const centerY = stageHeight / 2;
		const mousePointTo = {
			x: (centerX - panX) / zoom,
			y: (centerY - panY) / zoom
		};
		zoom = newZoom;
		panX = centerX - mousePointTo.x * newZoom;
		panY = centerY - mousePointTo.y * newZoom;
	}

	function resetView() {
		zoom = 1;
		panX = 0;
		panY = 0;
	}

	// Pan functions - drag to pan, click (without drag) to place point
	function handleMouseDown(e: { evt: MouseEvent; target: Konva.Node }) {
		if (e.evt.button === 0) {
			// Left click
			isPanning = true;
			hasDragged = false;
			mouseDownPoint = { x: e.evt.clientX, y: e.evt.clientY };
			lastPanPoint = { x: e.evt.clientX, y: e.evt.clientY };
		}
	}

	function handleMouseMove(e: { evt: MouseEvent }) {
		if (!isPanning || !lastPanPoint || !mouseDownPoint) return;

		const dx = e.evt.clientX - lastPanPoint.x;
		const dy = e.evt.clientY - lastPanPoint.y;

		// Check if we've moved past the drag threshold
		const totalDx = Math.abs(e.evt.clientX - mouseDownPoint.x);
		const totalDy = Math.abs(e.evt.clientY - mouseDownPoint.y);
		if (totalDx > DRAG_THRESHOLD || totalDy > DRAG_THRESHOLD) {
			hasDragged = true;
		}

		if (hasDragged) {
			panX += dx;
			panY += dy;
			if (containerEl) containerEl.style.cursor = 'grabbing';
		}

		lastPanPoint = { x: e.evt.clientX, y: e.evt.clientY };
	}

	function handleMouseUp() {
		// If we didn't drag, this was a click - place a point
		if (isPanning && !hasDragged) {
			placePoint();
		}

		isPanning = false;
		lastPanPoint = null;
		mouseDownPoint = null;
		hasDragged = false;
		if (containerEl) containerEl.style.cursor = 'crosshair';
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse') return;

		const point = { x: e.clientX, y: e.clientY };
		pointers.set(e.pointerId, point);

		if (pointers.size === 2) {
			isPinching = true;
			touchHasDragged = true; // Prevent point placement during pinch
			const [p1, p2] = Array.from(pointers.values());
			lastPinchDistance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
			lastPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
		} else if (pointers.size === 1) {
			touchStartPoint = point;
			touchHasDragged = false;
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (e.pointerType === 'mouse') return;

		const currentPointer = pointers.get(e.pointerId);
		if (!currentPointer) return;

		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (pointers.size === 2 && isPinching) {
			e.preventDefault();
			const [p1, p2] = Array.from(pointers.values());
			const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
			const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

			if (lastPinchDistance > 0 && lastPinchCenter) {
				const scale = distance / lastPinchDistance;
				const oldZoom = zoom;
				const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * scale));
				const pinchPointTo = {
					x: (lastPinchCenter.x - panX) / oldZoom,
					y: (lastPinchCenter.y - panY) / oldZoom
				};
				zoom = newZoom;
				panX = center.x - pinchPointTo.x * newZoom;
				panY = center.y - pinchPointTo.y * newZoom;
			}

			lastPinchDistance = distance;
			lastPinchCenter = center;
		} else if (pointers.size === 1 && !isPinching) {
			// Single finger - check for drag
			if (touchStartPoint) {
				const dx = Math.abs(e.clientX - touchStartPoint.x);
				const dy = Math.abs(e.clientY - touchStartPoint.y);
				if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
					touchHasDragged = true;
				}
			}
			// Pan with single finger
			if (touchHasDragged) {
				const prev = currentPointer;
				panX += e.clientX - prev.x;
				panY += e.clientY - prev.y;
			}
		}
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.pointerType === 'mouse') return;

		pointers.delete(e.pointerId);

		if (pointers.size < 2) {
			isPinching = false;
			lastPinchDistance = 0;
			lastPinchCenter = null;
		}

		// If single finger and didn't drag, place a point
		if (pointers.size === 0 && !touchHasDragged && !isPinching) {
			placePoint();
		}

		if (pointers.size === 0) {
			touchStartPoint = null;
			touchHasDragged = false;
		}
	}

	function handleConfirm() {
		if (scale > 0) {
			onCalibrate(scale, referenceLength);
		}
	}
</script>

<div class="flex flex-col h-full">
	<div class="p-4 bg-secondary text-white">
		<h2 class="font-semibold mb-1">{m.canvas_calibrate_title()}</h2>
		<p class="text-sm text-blue-100">
			{m.canvas_calibrate_description()}
			<span class="hidden md:inline"><strong>{m.canvas_calibrate_desktop_hint()}</strong></span>
			<span class="md:hidden"><strong>{m.canvas_calibrate_mobile_hint()}</strong></span>
		</p>
	</div>

	<div
		bind:this={containerEl}
		class="flex-1 bg-slate-900 relative cursor-crosshair"
		onwheel={handleWheel}
		oncontextmenu={handleContextMenu}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		style="touch-action: none;"
		role="application"
	>
		<Stage
			bind:this={stageRef}
			width={stageWidth}
			height={stageHeight}
			scaleX={zoom}
			scaleY={zoom}
			x={panX}
			y={panY}
			onmousedown={handleMouseDown}
			onmousemove={handleMouseMove}
			onmouseup={handleMouseUp}
			onmouseleave={handleMouseUp}
		>
			<Layer>
				{#if image}
					<KonvaImage
						{image}
						x={imageDimensions.x}
						y={imageDimensions.y}
						width={imageDimensions.width}
						height={imageDimensions.height}
					/>
				{/if}

				{#if point1}
					<Circle
						x={point1.x}
						y={point1.y}
						radius={12 / zoom}
						fill="#60A5FA"
						stroke="#fff"
						strokeWidth={2 / zoom}
					/>
				{/if}

				{#if point2}
					<Circle
						x={point2.x}
						y={point2.y}
						radius={12 / zoom}
						fill="#60A5FA"
						stroke="#fff"
						strokeWidth={2 / zoom}
					/>
				{/if}

				{#if point1 && point2}
					<Line
						points={[point1.x, point1.y, point2.x, point2.y]}
						stroke="#60A5FA"
						strokeWidth={3 / zoom}
						dash={[10 / zoom, 5 / zoom]}
					/>
					<Text
						x={(point1.x + point2.x) / 2 + 10 / zoom}
						y={(point1.y + point2.y) / 2 - 20 / zoom}
						text={`${lineLength.toFixed(0)}px`}
						fill="#fff"
						fontSize={14 / zoom}
						fontFamily="JetBrains Mono"
					/>
				{/if}
			</Layer>
		</Stage>

		<!-- Zoom controls -->
		<div class="absolute top-2 right-2 flex flex-col gap-1 bg-surface-container-lowest rounded p-1">
			<Button
				variant="ghost"
				size="icon-sm"
				class="text-on-surface-variant"
				onclick={zoomIn}
				title={m.canvas_zoom_in()}
			>
				<Plus size={16} />
			</Button>
			<div class="text-xs text-center text-on-surface-variant py-1">
				{Math.round(zoom * 100)}%
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				class="text-on-surface-variant"
				onclick={zoomOut}
				title={m.canvas_zoom_out()}
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
		</div>
	</div>

	<div class="p-4 bg-surface-container-lowest">
		<div class="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
			<div class="flex-1">
				<Label for="length">{m.canvas_calibrate_length_label()}</Label>
				<Input id="length" type="number" bind:value={referenceLength} min={1} class="font-mono" />
			</div>
			<div class="text-sm text-on-surface-variant pb-2">
				{#if scale > 0}
					{m.canvas_calibrate_scale({ scale: scale.toFixed(2) })}
				{:else}
					{m.canvas_calibrate_no_line()}
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={onCancel} class="flex-1 md:flex-initial min-h-[44px]"
					>{m.common_cancel()}</Button
				>
				<Button
					onclick={handleConfirm}
					disabled={scale === 0}
					class="flex-1 md:flex-initial min-h-[44px]">{m.canvas_calibrate_confirm()}</Button
				>
			</div>
		</div>
	</div>
</div>
