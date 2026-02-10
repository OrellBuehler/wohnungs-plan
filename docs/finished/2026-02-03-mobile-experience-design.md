# Mobile Experience Upgrade Design

**Date:** 2026-02-03
**Status:** Approved

## Overview

Upgrade the mobile experience to provide a streamlined, view-focused interface for floor planning. Users can view projects, explore floorplans, add new items, and edit item details on mobile, while placement and positioning remains desktop-only functionality.

## Requirements

### Mobile Capabilities
- View project list and open projects
- View floorplan with pan/zoom navigation
- Tap placed items to see details
- Add new items (unplaced, positioned later on desktop)
- Edit existing item details (name, price, dimensions, notes)
- Delete items
- Switch between Floorplan and Items tabs

### Mobile Restrictions
- Cannot place items on floorplan
- Cannot move or rotate items
- Cannot recalibrate or change floorplan
- No grid/snap controls needed

### Desktop Behavior
- Remains completely unchanged
- All existing functionality preserved

## Architecture

### Responsive Strategy

The existing codebase already uses Tailwind's responsive breakpoints (`md:` at 768px). We'll extend this pattern by:

1. Adding `isMobile` reactive state based on window width
2. Passing `readonly` prop to interactive components
3. Using conditional rendering to hide mobile-inappropriate controls
4. Maintaining single source of truth for all state

### Key Principle

No mobile-specific state or API calls. Components adapt behavior based on `readonly` flag, but the underlying data model and mutation functions remain identical across viewport sizes.

## Component Design

### New Component: ItemBottomSheet.svelte

**Purpose:** Display item details when user taps a placed item on mobile floorplan

**Features:**
- Slides up from bottom (~40% screen height)
- Semi-transparent backdrop
- Swipe down or tap backdrop to close
- Displays: name, price, dimensions, notes
- "Edit Item" button opens full ItemForm
- Uses shadcn-svelte Sheet component

**Props:**
```typescript
{
  open: boolean
  item: Item | null
  onEdit: (id: string) => void
  onClose: () => void
}
```

### Modified: FloorplanCanvas.svelte

**New Prop:**
```typescript
readonly: boolean = false
```

**Behavior Changes When readonly=true:**
- Disable drag handlers on items
- Disable rotation controls
- Remove context menu
- Hide resize/rotate handles
- Remove hover effects
- Pan/zoom remains enabled
- Click/tap still fires `onItemSelect` for bottom sheet

### Modified: ItemList.svelte

**New Prop:**
```typescript
readonly: boolean = false
```

**Behavior Changes When readonly=true:**
- Hide "Place Item" buttons for unplaced items
- Keep "Edit" and "Delete" buttons visible
- Keep "Add Item" button visible (adds unplaced items)

### Modified: ItemForm.svelte

**New Prop:**
```typescript
hidePositionFields: boolean = false
```

**Behavior Changes:**
- When true, hide position/placement-related fields
- Form validation doesn't require position
- Saving creates/updates item without position data

### Conditional: CanvasControls.svelte

**Mobile Behavior:**
- Hidden entirely on mobile via `{#if !isMobile}`
- No grid toggle, snap controls, recalibrate, or change floorplan buttons

## Data Flow

### Mobile Detection

```typescript
// In /projects/[id]/+page.svelte
let isMobile = $state(false);

onMount(() => {
  const updateMobile = () => {
    isMobile = window.innerWidth < 768; // md breakpoint
  };
  updateMobile();
  window.addEventListener('resize', updateMobile);
  return () => window.removeEventListener('resize', updateMobile);
});
```

### Item Tap Flow (Mobile)

1. User taps placed item on floorplan
2. `FloorplanCanvas` fires `onItemSelect(id)`
3. Page opens `ItemBottomSheet` with item data
4. User clicks "Edit" → opens `ItemForm` with `hidePositionFields={true}`
5. User saves → `updateItem()` updates all fields except position/rotation
6. Bottom sheet closes, canvas updates reactively

### Add Item Flow (Mobile)

1. User clicks "Add Item" in `ItemList`
2. `ItemForm` opens with `hidePositionFields={true}`
3. User fills name, price, dimensions, notes
4. User saves → `addItem()` creates item with `position: null`
5. Item appears in list with "Not Placed" indicator

### Edit Item Flow (Mobile)

1. From bottom sheet OR item list, user clicks "Edit"
2. `ItemForm` opens with item data, `hidePositionFields={true}`
3. User modifies details (not position/rotation)
4. User saves → `updateItem()` preserves existing position/rotation
5. Changes reflect immediately via reactive state

## UI/UX Details

### Bottom Sheet Design

- Height: ~40% of viewport
- Backdrop: semi-transparent dark overlay
- Close triggers: swipe down, tap backdrop, close button
- Content layout:
  - Item name (text-xl font-bold)
  - Price with currency badge
  - Dimensions (width × height with unit)
  - Notes/description (scrollable if long)
  - "Edit Item" button (primary)
  - Close button (secondary)

### Visual Indicators

- Placed items on canvas: tappable, but no visual handles
- Unplaced items: only appear in list, not on canvas
- "Not Placed" badge: existing design, unchanged
- No "view-only mode" banner needed (UI naturally communicates)

### Touch Targets

- Minimum 44px tap targets for mobile items
- Adequate spacing between list items
- Bottom sheet drag handle for swipe gesture

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Add item on mobile, switch to desktop | Item appears unplaced in list, can be placed normally |
| Edit details on mobile | Changes persist, position/rotation preserved |
| Rapid taps on canvas | Debounce handler to prevent multiple sheets |
| Bottom sheet open during tab switch | Auto-close sheet on tab change |
| Item deleted while sheet open | Close sheet, show toast notification |
| Resize window mobile↔desktop | Re-evaluate `isMobile`, adjust UI accordingly |
| No placed items on canvas | Canvas shows empty floorplan, tap does nothing |

## Implementation Plan

### Phase 1: Foundation
1. Add mobile detection state to project page
2. Create `ItemBottomSheet.svelte` component with shadcn Sheet
3. Wire up basic open/close logic

### Phase 2: Canvas Updates
4. Add `readonly` prop to `FloorplanCanvas.svelte`
5. Disable drag/rotate/context menu when readonly
6. Update tap handler to work with bottom sheet
7. Hide canvas controls on mobile

### Phase 3: List Updates
8. Add `readonly` prop to `ItemList.svelte`
9. Hide "Place Item" buttons when readonly
10. Update `ItemForm` to hide position fields

### Phase 4: Integration
11. Pass `readonly={isMobile}` to all components
12. Wire bottom sheet to canvas tap events
13. Test tab switching behavior
14. Test item CRUD operations on mobile

### Phase 5: Polish & Testing
15. Adjust touch targets and spacing
16. Test on real mobile devices
17. Verify desktop unchanged
18. Handle edge cases

## Testing Checklist

- [ ] Add item on mobile → appears unplaced
- [ ] Edit item details on mobile → changes persist
- [ ] Edit preserves position/rotation if set
- [ ] Tap placed item → bottom sheet opens
- [ ] Bottom sheet shows correct data
- [ ] Edit from bottom sheet → form opens
- [ ] Pan/zoom works on mobile canvas
- [ ] Switch tabs → bottom sheet closes
- [ ] Delete item → bottom sheet closes if open
- [ ] No canvas controls visible on mobile
- [ ] Place button hidden on mobile
- [ ] Desktop behavior completely unchanged
- [ ] Resize window updates mobile detection
- [ ] Touch targets adequate size (44px min)

## Success Metrics

- Mobile users can view all project data
- Mobile users can add/edit items without placement
- No regressions in desktop functionality
- Clean, intuitive mobile interface
- Consistent with existing design system
