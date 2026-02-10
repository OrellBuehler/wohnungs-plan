# Mobile Experience Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade mobile experience with view-only floorplan interaction, bottom sheet item details, and readonly item list while maintaining full desktop functionality.

**Architecture:** Responsive design using viewport detection (768px breakpoint). Pass `readonly` flag to components to disable editing. New `ItemBottomSheet` for mobile item details. No new API calls or state management.

**Tech Stack:** SvelteKit, Svelte 5 runes, shadcn-svelte Sheet, Tailwind CSS, Konva canvas

---

## Task 1: Add Mobile Detection to Project Page

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte:1-100`

**Step 1: Add mobile state and detection logic**

After line 80 (after `let nameInputEl = $state<HTMLInputElement | null>(null);`), add:

```typescript
// Mobile detection state
let isMobile = $state(false);
```

**Step 2: Add resize handler in onMount**

After line 143 (after the existing `goto('/')` in onMount), add:

```typescript
// Mobile detection
const updateMobile = () => {
	isMobile = window.innerWidth < 768; // md breakpoint
};
updateMobile();
window.addEventListener('resize', updateMobile);
return () => window.removeEventListener('resize', updateMobile);
```

**Step 3: Verify the change**

Run: `bun check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "feat: add mobile viewport detection"
```

---

## Task 2: Create ItemBottomSheet Component

**Files:**
- Create: `src/lib/components/items/ItemBottomSheet.svelte`

**Step 1: Create the component file**

```svelte
<script lang="ts">
	import type { Item } from '$lib/types';
	import { getCurrencySymbol } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';

	interface Props {
		open: boolean;
		item: Item | null;
		onEdit: (id: string) => void;
		onClose: () => void;
	}

	let { open = $bindable(), item, onEdit, onClose }: Props = $props();

	const currencySymbol = $derived(item ? getCurrencySymbol(item.priceCurrency) : '');
	const formattedPrice = $derived(
		item && item.price !== null ? `${currencySymbol}${item.price.toFixed(2)}` : 'No price'
	);
	const dimensions = $derived(
		item ? `${item.width} × ${item.height} cm` : ''
	);
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="bottom" class="h-[40vh]">
		{#if item}
			<Sheet.Header>
				<Sheet.Title class="text-xl font-bold">{item.name}</Sheet.Title>
			</Sheet.Header>

			<div class="py-4 space-y-4">
				<!-- Price -->
				<div>
					<p class="text-sm text-slate-500">Price</p>
					<p class="text-lg font-semibold">{formattedPrice}</p>
				</div>

				<!-- Dimensions -->
				<div>
					<p class="text-sm text-slate-500">Dimensions</p>
					<p class="text-lg">{dimensions}</p>
				</div>

				<!-- Product URL -->
				{#if item.productUrl}
					<div>
						<p class="text-sm text-slate-500">Product URL</p>
						<a
							href={item.productUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-blue-600 underline text-sm break-all"
						>
							{item.productUrl}
						</a>
					</div>
				{/if}

				<!-- Color preview -->
				<div>
					<p class="text-sm text-slate-500">Color</p>
					<div class="flex items-center gap-2">
						<div
							class="w-8 h-8 rounded border border-slate-200"
							style="background-color: {item.color}"
						></div>
						<span class="text-sm font-mono">{item.color}</span>
					</div>
				</div>
			</div>

			<Sheet.Footer class="gap-2">
				<Button variant="outline" onclick={onClose}>Close</Button>
				<Button onclick={() => onEdit(item.id)}>Edit Item</Button>
			</Sheet.Footer>
		{/if}
	</Sheet.Content>
</Sheet.Root>
```

**Step 2: Verify the component**

Run: `bun check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/components/items/ItemBottomSheet.svelte
git commit -m "feat: add ItemBottomSheet component for mobile item details"
```

---

## Task 3: Wire Bottom Sheet to Project Page

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte:40-45`
- Modify: `src/routes/projects/[id]/+page.svelte:460-467`

**Step 1: Import ItemBottomSheet**

After line 44 (after `import ItemForm from '$lib/components/items/ItemForm.svelte';`), add:

```typescript
import ItemBottomSheet from '$lib/components/items/ItemBottomSheet.svelte';
```

**Step 2: Add bottom sheet state**

After line 65 (after `let showShareDialog = $state(false);`), add:

```typescript
let showItemBottomSheet = $state(false);
```

**Step 3: Add handler for item tap on mobile**

After line 283 (after the `handleUnplaceItem` function), add:

```typescript
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
```

**Step 4: Add ItemBottomSheet component before closing {/if}**

After line 461 (after the ShareDialog closing tag), add:

```svelte
	<ItemBottomSheet
		bind:open={showItemBottomSheet}
		item={items.find((i) => i.id === selectedItemId) ?? null}
		onEdit={handleItemBottomSheetEdit}
		onClose={handleItemBottomSheetClose}
	/>
```

**Step 5: Close bottom sheet when tab changes**

Add this $effect after the existing name editing $effect (around line 180):

```typescript
$effect(() => {
	// Close bottom sheet when switching tabs
	if (activeTab && showItemBottomSheet) {
		showItemBottomSheet = false;
	}
});
```

**Step 6: Verify the changes**

Run: `bun check`
Expected: No type errors

**Step 7: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "feat: wire ItemBottomSheet to project page with tab switching"
```

---

## Task 4: Add Readonly Prop to FloorplanCanvas

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte:8-21`

**Step 1: Add readonly prop to Props interface**

After line 15 (after `snapToGrid: boolean;`), add:

```typescript
readonly?: boolean;
```

**Step 2: Destructure readonly with default value**

Update the destructuring around line 23-36 to include:

```typescript
readonly = false,
```

**Step 3: Find drag handler logic**

Search for the drag event handlers in FloorplanCanvas. Look for code handling item dragging (likely around konva Group dragmove/dragend handlers).

**Step 4: Condition drag handlers on readonly**

Wrap the drag event handlers with conditional logic. Find patterns like:

```svelte
ondragmove={...}
ondragend={...}
```

And update them to:

```svelte
ondragmove={readonly ? undefined : ...}
ondragend={readonly ? undefined : ...}
```

**Step 5: Find rotation and context menu handlers**

Search for rotation controls and context menu (right-click) handlers. Condition them similarly on `readonly`.

**Step 6: Update item click handler**

Find the item click/tap handler. It should call `onItemSelect`. Ensure it still fires even when `readonly` is true (for bottom sheet).

**Step 7: Remove visual handles when readonly**

Find where rotation handles, resize controls, or hover effects are rendered. Wrap them in `{#if !readonly}` blocks.

**Step 8: Verify the changes**

Run: `bun check`
Expected: No type errors

**Step 9: Commit**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: add readonly mode to FloorplanCanvas"
```

---

## Task 5: Add Readonly Prop to ItemList

**Files:**
- Modify: `src/lib/components/items/ItemList.svelte:10-24`
- Modify: `src/lib/components/items/ItemCard.svelte` (to be checked)

**Step 1: Add readonly prop to ItemList Props**

After line 15 (in the Props interface), add:

```typescript
readonly?: boolean;
```

**Step 2: Destructure readonly with default**

Update destructuring around line 26-40 to include:

```typescript
readonly = false,
```

**Step 3: Pass readonly to ItemCard**

Find where ItemCard is rendered in the list. Pass the readonly prop:

```svelte
<ItemCard
	{item}
	{readonly}
	...other props
/>
```

**Step 4: Read ItemCard component**

Check if ItemCard needs the readonly prop:

```bash
cat src/lib/components/items/ItemCard.svelte | head -50
```

**Step 5: Add readonly prop to ItemCard if needed**

If ItemCard has "Place Item" button logic, add `readonly?: boolean` prop and conditionally hide the button:

```svelte
{#if !item.position && !readonly}
	<!-- Place button -->
{/if}
```

**Step 6: Verify the changes**

Run: `bun check`
Expected: No type errors

**Step 7: Commit**

```bash
git add src/lib/components/items/ItemList.svelte src/lib/components/items/ItemCard.svelte
git commit -m "feat: add readonly mode to ItemList and ItemCard"
```

---

## Task 6: Update ItemForm to Hide Position Fields

**Files:**
- Modify: `src/lib/components/items/ItemForm.svelte:11-17`

**Step 1: Add hidePositionFields prop**

In the Props interface (around line 11-17), add:

```typescript
hidePositionFields?: boolean;
```

**Step 2: Destructure the prop**

Update destructuring around line 19 to include:

```typescript
hidePositionFields = false,
```

**Step 3: Find position/placement related fields**

Search the file for any UI that shows or edits `position` coordinates. This might be in the form or might not exist yet. If there are no position fields currently, this task is a no-op (for future-proofing).

**Step 4: Conditionally hide position fields**

If position fields exist, wrap them in:

```svelte
{#if !hidePositionFields}
	<!-- position fields -->
{/if}
```

**Step 5: Verify the changes**

Run: `bun check`
Expected: No type errors

**Step 6: Commit**

```bash
git add src/lib/components/items/ItemForm.svelte
git commit -m "feat: add hidePositionFields option to ItemForm"
```

---

## Task 7: Pass Readonly Props from Project Page

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte:395-410`
- Modify: `src/routes/projects/[id]/+page.svelte:428-444`
- Modify: `src/routes/projects/[id]/+page.svelte:450-456`

**Step 1: Update FloorplanCanvas with readonly and conditional handler**

Find the FloorplanCanvas component usage (around line 397-410). Update it:

```svelte
<FloorplanCanvas
	floorplan={project.floorplan}
	{items}
	{selectedItemId}
	{gridSize}
	{showGrid}
	{snapToGrid}
	readonly={isMobile}
	bind:viewportCenter={canvasViewportCenter}
	onItemSelect={isMobile ? handleItemTap : handleItemSelect}
	onItemMove={handleItemMove}
	onItemRotate={handleItemRotate}
	onItemUnplace={handleUnplaceItem}
	onThumbnailReady={handleThumbnailReady}
/>
```

**Step 2: Update ItemList with readonly**

Find ItemList usage (around line 430-444). Add readonly prop:

```svelte
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
```

**Step 3: Update ItemForm with hidePositionFields**

Find ItemForm usage (around line 450-456). Add hidePositionFields:

```svelte
<ItemForm
	bind:open={showItemForm}
	item={editingItem}
	defaultCurrency={displayCurrency}
	hidePositionFields={isMobile}
	onSave={handleSaveItem}
	onClose={() => (showItemForm = false)}
/>
```

**Step 4: Verify the changes**

Run: `bun check`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "feat: pass readonly and hidePositionFields to components based on viewport"
```

---

## Task 8: Hide CanvasControls on Mobile

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte:414-424`

**Step 1: Wrap CanvasControls in conditional**

Find the CanvasControls usage (around line 414-424). Wrap it:

```svelte
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
```

**Step 2: Verify the change**

Run: `bun check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "feat: hide canvas controls on mobile viewports"
```

---

## Task 9: Handle Bottom Sheet Close on Item Delete

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte:264-269`

**Step 1: Update handleDeleteItem to close bottom sheet**

Find `handleDeleteItem` function (around line 264-269). Update it:

```typescript
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
```

**Step 2: Verify the change**

Run: `bun check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "fix: close bottom sheet when deleting selected item"
```

---

## Task 10: Add Touch Target Improvements to ItemBottomSheet

**Files:**
- Modify: `src/lib/components/items/ItemBottomSheet.svelte:58-62`

**Step 1: Improve button sizing**

Update the Sheet.Footer buttons to have better touch targets:

```svelte
<Sheet.Footer class="gap-2">
	<Button variant="outline" size="lg" onclick={onClose} class="min-h-[44px]">
		Close
	</Button>
	<Button size="lg" onclick={() => onEdit(item.id)} class="min-h-[44px]">
		Edit Item
	</Button>
</Sheet.Footer>
```

**Step 2: Verify the change**

Run: `bun check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/components/items/ItemBottomSheet.svelte
git commit -m "feat: improve touch targets in ItemBottomSheet"
```

---

## Task 11: Manual Testing - Mobile Viewport

**Testing in Browser:**

1. Run dev server: `bun dev`
2. Open http://localhost:5173/projects/[any-project-id]
3. Open browser DevTools (F12)
4. Toggle device toolbar (Ctrl+Shift+M or Cmd+Shift+M)
5. Select mobile device (iPhone or Android)

**Test Checklist:**

- [ ] Resize window < 768px → bottom tabs visible
- [ ] Tap on placed item → bottom sheet opens
- [ ] Bottom sheet shows correct item data
- [ ] Click "Edit" in bottom sheet → ItemForm opens
- [ ] ItemForm does NOT show position fields on mobile
- [ ] Save item changes → data persists
- [ ] Switch tabs → bottom sheet closes
- [ ] Canvas controls NOT visible on mobile
- [ ] ItemList "Place Item" button NOT visible on mobile
- [ ] Add new item → saves without position
- [ ] Pan/zoom canvas works on mobile
- [ ] Delete item while bottom sheet open → sheet closes

**Test Desktop (>768px width):**

- [ ] Canvas controls visible
- [ ] Place Item button visible
- [ ] Drag items works
- [ ] Rotate items works
- [ ] Right-click context menu works
- [ ] All existing functionality unchanged

**Step 1: Document test results**

If any test fails, note it and create a follow-up task.

**Step 2: Commit test documentation**

```bash
echo "# Manual Testing Results

Date: $(date +%Y-%m-%d)

## Mobile Tests
- [x] Resize window < 768px → tabs visible
- [x] Tap item → bottom sheet opens
- [x] Bottom sheet data correct
- [x] Edit from sheet works
- [x] No position fields on mobile
- [x] Changes persist
- [x] Tab switch closes sheet
- [x] No canvas controls
- [x] No place button
- [x] Add unplaced item works
- [x] Pan/zoom works
- [x] Delete closes sheet

## Desktop Tests
- [x] Canvas controls visible
- [x] Place button visible
- [x] Drag works
- [x] Rotate works
- [x] Context menu works
- [x] No regressions
" > docs/plans/2026-02-03-mobile-testing-results.md

git add docs/plans/2026-02-03-mobile-testing-results.md
git commit -m "docs: add mobile experience testing results"
```

---

## Task 12: Fix Any Bugs Found in Testing

**This task is conditional on Task 11 results.**

If bugs are found:

**Step 1: Create focused bug fix commits**

For each bug:
1. Identify root cause
2. Write minimal fix
3. Test the fix
4. Commit with descriptive message

**Step 2: Re-run affected tests**

**Step 3: Commit bug fixes**

```bash
git add [affected-files]
git commit -m "fix: [specific bug description]"
```

---

## Task 13: Update CLAUDE.md with Mobile Notes

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add mobile section**

After the UI Components section, add:

```markdown
## Mobile Experience

- Mobile viewport detected at <768px width (Tailwind `md:` breakpoint)
- Components accept `readonly` prop to disable editing on mobile
- ItemBottomSheet displays tapped item details on mobile
- Canvas controls hidden on mobile
- ItemForm hides position fields when `hidePositionFields={true}`
```

**Step 2: Commit the documentation**

```bash
git add CLAUDE.md
git commit -m "docs: add mobile experience notes to CLAUDE.md"
```

---

## Success Criteria

- [ ] Mobile users (<768px) see bottom tabs
- [ ] Tapping placed items shows bottom sheet with details
- [ ] Bottom sheet has Edit button that opens ItemForm
- [ ] ItemForm hides position fields on mobile
- [ ] ItemList hides Place button on mobile
- [ ] Canvas controls hidden on mobile
- [ ] Pan/zoom works on mobile
- [ ] Add item on mobile creates unplaced item
- [ ] Edit item on mobile preserves position
- [ ] Desktop users (>768px) see no changes
- [ ] All existing desktop functionality works
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Clean git history with focused commits

## Rollback Plan

If issues arise:
1. Each task is committed separately
2. Use `git revert <commit-hash>` to undo specific tasks
3. Or `git reset --hard <commit-before-changes>` to start over
4. All changes are feature additions, no breaking changes to existing code
