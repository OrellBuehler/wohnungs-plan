# Mobile Experience Testing Checklist

**Date:** 2026-02-03
**Feature:** Mobile Experience Upgrade
**Tester:** _________________
**Test Date:** _________________

## Setup Instructions

1. **Start the development server:**
   ```bash
   bun dev
   ```

2. **Open browser:** http://localhost:5173

3. **Open DevTools:**
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)

4. **Toggle device toolbar:**
   - Chrome/Edge: `Ctrl+Shift+M` (Windows/Linux) / `Cmd+Shift+M` (Mac)
   - Or click the device icon in DevTools toolbar

5. **Select a mobile device:**
   - iPhone 12 Pro (390px width) - recommended
   - Or manually set viewport to 375px width

---

## Test Suite A: Mobile Viewport (<768px)

### A1: Viewport Detection
- [ ] Resize window to <768px width
- [ ] Bottom navigation tabs appear (Plan / Items)
- [ ] Desktop sidebar is hidden
- [ ] Tabs switch between Plan and Items views

**Notes:** _____________________________________________

---

### A2: Floorplan Canvas Interaction

**Prerequisites:** Have a project with floorplan and at least 2 placed items

- [ ] Open a project with placed items
- [ ] Canvas displays floorplan image correctly
- [ ] Pan gesture works (drag background to move view)
- [ ] Pinch-to-zoom works (or +/- buttons if using DevTools)
- [ ] Canvas controls (grid toggle, snap, recalibrate) are NOT visible
- [ ] Items are visible on canvas

**Notes:** _____________________________________________

---

### A3: Item Tap Interaction

- [ ] Tap a placed item on canvas
- [ ] Bottom sheet slides up from bottom (~40% screen height)
- [ ] Bottom sheet displays correct item data:
  - [ ] Item name as title
  - [ ] Price with correct currency symbol
  - [ ] Dimensions (width × height cm)
  - [ ] Product URL (if set) as clickable link
  - [ ] Color preview with hex code
- [ ] "Close" button is visible and large enough to tap easily
- [ ] "Edit Item" button is visible and large enough to tap easily

**Notes:** _____________________________________________

---

### A4: Bottom Sheet Interaction

**Prerequisites:** Bottom sheet is open from A3

- [ ] Tap "Close" button → bottom sheet closes
- [ ] Re-tap same item → bottom sheet opens again
- [ ] Tap "Edit Item" button → ItemForm opens
- [ ] Bottom sheet closes when ItemForm opens
- [ ] Tap backdrop/overlay → bottom sheet closes

**Notes:** _____________________________________________

---

### A5: Item Form on Mobile

**Prerequisites:** ItemForm is open (from bottom sheet or item list)

- [ ] Form displays all standard fields:
  - [ ] Name input
  - [ ] Width input
  - [ ] Height input
  - [ ] Color picker
  - [ ] Price input
  - [ ] Currency selector
  - [ ] Product URL input
  - [ ] Shape selector (Rectangle/L-shape)
- [ ] Form does NOT display position coordinate inputs
- [ ] Form does NOT display rotation controls
- [ ] Edit item details (change name, price, etc.)
- [ ] Save changes
- [ ] Changes persist correctly
- [ ] Item position on canvas is preserved (not reset to null)

**Notes:** _____________________________________________

---

### A6: Tab Switching Behavior

**Prerequisites:** Bottom sheet is open

- [ ] Switch from "Plan" tab to "Items" tab
- [ ] Bottom sheet automatically closes
- [ ] No error messages in console
- [ ] Switch back to "Plan" tab works correctly

**Notes:** _____________________________________________

---

### A7: Item List on Mobile

- [ ] Switch to "Items" tab
- [ ] Item list displays correctly
- [ ] Currency selector works
- [ ] Total cost displays correctly
- [ ] "Add Item" button is visible and works

**Test with UNPLACED item:**
- [ ] Item shows "Not Placed" indicator
- [ ] "Place" button is NOT visible
- [ ] "Edit" button IS visible
- [ ] "Delete" button IS visible
- [ ] "Duplicate" button is NOT visible

**Test with PLACED item:**
- [ ] Item shows position indicator or no "Not Placed" badge
- [ ] "Unplace" button is NOT visible
- [ ] "Edit" button IS visible
- [ ] "Delete" button IS visible
- [ ] "Duplicate" button is NOT visible

**Notes:** _____________________________________________

---

### A8: Add New Item on Mobile

- [ ] In Items tab, tap "Add Item" button
- [ ] ItemForm opens
- [ ] Fill out item details (name, size, color, price)
- [ ] Save new item
- [ ] New item appears in list with "Not Placed" indicator
- [ ] Item has `position: null` (not visible on canvas)

**Notes:** _____________________________________________

---

### A9: Delete Item with Bottom Sheet Open

- [ ] Switch to "Plan" tab
- [ ] Tap an item to open bottom sheet
- [ ] Without closing bottom sheet, switch to "Items" tab
- [ ] Find the same item in list
- [ ] Tap "Delete" button
- [ ] Confirm deletion
- [ ] Bottom sheet automatically closes (no stale data shown)
- [ ] Item is removed from list and canvas

**Notes:** _____________________________________________

---

### A10: Touch Target Accessibility

- [ ] All buttons in bottom sheet are easy to tap (at least 44px height)
- [ ] No accidental taps when trying to hit specific buttons
- [ ] Buttons have adequate spacing between them
- [ ] Text is readable on mobile screen

**Notes:** _____________________________________________

---

## Test Suite B: Desktop Viewport (≥768px)

### B1: Viewport Detection

- [ ] Resize window to ≥768px width
- [ ] Bottom tabs disappear
- [ ] Desktop layout appears (side-by-side panels)
- [ ] Canvas controls are visible

**Notes:** _____________________________________________

---

### B2: Canvas Controls Visible

- [ ] Canvas controls panel is visible below canvas
- [ ] Grid toggle works
- [ ] Snap to grid toggle works
- [ ] Grid size slider/control works
- [ ] Scale display shows correct value
- [ ] "Change Floorplan" button works
- [ ] "Recalibrate" button works

**Notes:** _____________________________________________

---

### B3: Item Interaction (Desktop)

- [ ] Click item on canvas → item selected (no bottom sheet)
- [ ] Drag item → item moves to new position
- [ ] Drag works smoothly with grid snap (if enabled)
- [ ] Right-click item → context menu appears
- [ ] Context menu shows rotation options
- [ ] Rotation via context menu works
- [ ] Item remains selected after operations

**Notes:** _____________________________________________

---

### B4: Item List (Desktop)

**Test with UNPLACED item:**
- [ ] "Place" button IS visible
- [ ] "Edit" button IS visible
- [ ] "Delete" button IS visible
- [ ] "Duplicate" button IS visible
- [ ] Click "Place" → item placed at canvas center

**Test with PLACED item:**
- [ ] "Unplace" button IS visible
- [ ] "Edit" button IS visible
- [ ] "Delete" button IS visible
- [ ] "Duplicate" button IS visible
- [ ] Click "Unplace" → item removed from canvas
- [ ] Click "Duplicate" → new item created with offset position

**Notes:** _____________________________________________

---

### B5: No Regressions

- [ ] All existing desktop functionality works as before
- [ ] No console errors
- [ ] No visual glitches
- [ ] Performance is acceptable
- [ ] Multi-item selection works (if implemented)
- [ ] Keyboard shortcuts work (if implemented)

**Notes:** _____________________________________________

---

## Test Suite C: Responsive Behavior

### C1: Window Resize

- [ ] Start at desktop width (>768px)
- [ ] Slowly resize window to mobile width (<768px)
- [ ] UI smoothly transitions to mobile layout
- [ ] No flash of wrong layout
- [ ] No JavaScript errors in console

**Notes:** _____________________________________________

---

### C2: Orientation Change (Real Device/Emulator)

If testing on real mobile device:

- [ ] Open app in portrait mode
- [ ] Rotate to landscape mode
- [ ] UI adapts correctly
- [ ] Bottom sheet still works
- [ ] Canvas remains functional

**Notes:** _____________________________________________

---

## Test Suite D: Edge Cases

### D1: Empty States

- [ ] Open project with no floorplan → no canvas controls shown
- [ ] Open project with no items → item list shows empty state
- [ ] Works correctly on both mobile and desktop

**Notes:** _____________________________________________

---

### D2: Item with No Price/URL

- [ ] Create item without price → bottom sheet shows "No price"
- [ ] Create item without product URL → URL section not shown in bottom sheet
- [ ] No errors or visual issues

**Notes:** _____________________________________________

---

### D3: Very Long Item Names/URLs

- [ ] Create item with very long name (50+ characters)
- [ ] Bottom sheet displays name with proper wrapping
- [ ] Create item with very long URL
- [ ] URL wraps properly with `break-all` class
- [ ] No overflow issues

**Notes:** _____________________________________________

---

### D4: Multiple Rapid Taps

- [ ] Rapidly tap same item multiple times
- [ ] Bottom sheet opens only once (no multiple instances)
- [ ] No JavaScript errors
- [ ] Closing and re-opening works correctly

**Notes:** _____________________________________________

---

## Test Suite E: Browser Compatibility

Test in multiple browsers if possible:

### E1: Chrome/Edge
- [ ] All mobile tests pass
- [ ] All desktop tests pass
- [ ] No browser-specific issues

**Notes:** _____________________________________________

---

### E2: Firefox
- [ ] All mobile tests pass
- [ ] All desktop tests pass
- [ ] No browser-specific issues

**Notes:** _____________________________________________

---

### E3: Safari (Mac/iOS)
- [ ] All mobile tests pass
- [ ] All desktop tests pass
- [ ] Touch interactions work properly
- [ ] No browser-specific issues

**Notes:** _____________________________________________

---

## Bugs Found

**Bug #1:**
- **Description:** ________________________________________
- **Steps to Reproduce:** _________________________________
- **Expected:** __________________________________________
- **Actual:** ____________________________________________
- **Severity:** Critical / Important / Minor

---

**Bug #2:**
- **Description:** ________________________________________
- **Steps to Reproduce:** _________________________________
- **Expected:** __________________________________________
- **Actual:** ____________________________________________
- **Severity:** Critical / Important / Minor

---

**Bug #3:**
- **Description:** ________________________________________
- **Steps to Reproduce:** _________________________________
- **Expected:** __________________________________________
- **Actual:** ____________________________________________
- **Severity:** Critical / Important / Minor

---

## Summary

**Total Tests:** 50+
**Tests Passed:** _____ / _____
**Tests Failed:** _____ / _____
**Bugs Found:** _____ (Critical: ___ / Important: ___ / Minor: ___)

**Overall Assessment:**
- [ ] Ready for production
- [ ] Needs bug fixes
- [ ] Needs major rework

**Tester Signature:** _________________
**Date Completed:** _________________

---

## Next Steps

After completing testing:

1. **If bugs found:** Document them in the "Bugs Found" section above
2. **Create bug fix commits:** Follow Task 12 in the implementation plan
3. **Re-test:** Run relevant tests again after fixes
4. **Update CLAUDE.md:** Add any additional mobile notes if needed
5. **Consider deployment:** If all tests pass, feature is ready for merge/deploy
