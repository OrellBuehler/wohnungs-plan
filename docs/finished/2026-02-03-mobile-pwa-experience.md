# Mobile PWA Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the floorplanner into a native-feeling PWA with fixed navigation, canvas pinch-to-zoom, and offline support.

**Architecture:** Disable browser zoom via viewport meta, implement fixed header/tabs layout with safe area insets, add touch gestures (pinch-to-zoom, pan) to canvas using PointerEvent API, configure PWA with service worker for offline support.

**Tech Stack:** SvelteKit, Konva (existing), native PointerEvent API, @vite-pwa/sveltekit, Workbox

---

## Task 1: Update Viewport Configuration

**Files:**
- Modify: `src/app.html:4-5`

**Step 1: Update viewport meta tag**

Replace the existing viewport meta tag with:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
```

**Explanation:**
- `user-scalable=no` - Disables browser pinch-to-zoom
- `maximum-scale=1` - Prevents zoom on input focus (iOS)
- `viewport-fit=cover` - Extends content into safe areas (notches)

**Step 2: Test in browser**

Run: `bun dev`

Open in browser, inspect viewport meta tag in DevTools, try pinch-to-zoom (should be disabled)

Expected: Browser zoom disabled

**Step 3: Commit**

```bash
git add src/app.html
git commit -m "feat: disable browser zoom for mobile PWA experience"
```

---

## Task 2: Add iOS PWA Meta Tags

**Files:**
- Modify: `src/routes/+layout.svelte:24-30`

**Step 1: Add iOS-specific meta tags**

Add these meta tags inside the `<svelte:head>` block (after the manifest link):

```svelte
<svelte:head>
  <!-- version: {import.meta.env.VITE_GIT_HASH || 'dev'} | built: {import.meta.env.VITE_BUILD_TIMESTAMP || 'dev'} -->
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#4E74FF" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
</svelte:head>
```

**Step 2: Test in browser**

Run: `bun dev`

Inspect head in DevTools, verify new meta tags are present

Expected: iOS PWA meta tags visible in DOM

**Step 3: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: add iOS PWA meta tags for fullscreen mode"
```

---

## Task 3: Update Root Layout to Use Dynamic Viewport Height

**Files:**
- Modify: `src/routes/+layout.svelte:33`

**Step 1: Change layout container to use 100dvh**

Update the root div's style:

```svelte
<div class="h-screen bg-slate-100 flex flex-col overflow-hidden" style="height: 100dvh;">
  {@render children()}
</div>
```

**Explanation:**
- `100dvh` accounts for mobile browser chrome appearing/disappearing
- Prevents layout jumps when address bar hides

**Step 2: Test on mobile**

Run: `bun dev`

Open on mobile device or DevTools mobile emulator, scroll to hide address bar

Expected: Layout doesn't jump when address bar hides/shows

**Step 3: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: use dynamic viewport height to prevent layout jumps"
```

---

## Task 4: Add Safe Area Insets to Header

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte:398`

**Step 1: Add safe area inset to header**

Update the header element to include safe area padding:

```svelte
<header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0" style="padding-top: env(safe-area-inset-top);">
```

Add `flex-shrink-0` class to prevent header from shrinking.

**Step 2: Test on device with notch**

Run: `bun dev`

Test on iPhone or simulator with notch

Expected: Header content doesn't get hidden behind notch

**Step 3: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "feat: add safe area inset to header for notched devices"
```

---

## Task 5: Add Safe Area Insets to Mobile Navigation

**Files:**
- Modify: `src/lib/components/layout/MobileNav.svelte:12`

**Step 1: Add safe area inset and flex-shrink-0 to nav**

Update the nav element:

```svelte
<nav class="h-14 bg-white border-t border-slate-200 flex md:hidden flex-shrink-0" style="padding-bottom: env(safe-area-inset-bottom);">
```

**Step 2: Test on device with home indicator**

Run: `bun dev`

Test on iPhone or Android with gesture navigation

Expected: Tab buttons visible above home indicator

**Step 3: Commit**

```bash
git add src/lib/components/layout/MobileNav.svelte
git commit -m "feat: add safe area inset to mobile nav for gesture bars"
```

---

## Task 6: Test Fixed Layout Foundation

**Files:**
- Test only

**Step 1: Test fixed header on mobile**

Run: `bun dev`

Open on mobile, scroll content in plan view

Expected: Header stays fixed at top

**Step 2: Test fixed tabs on mobile**

Switch to items tab, scroll item list

Expected: Bottom tabs stay fixed

**Step 3: Test content scrolling**

Scroll canvas area and item list independently

Expected: Only content area scrolls, header/tabs fixed

**Step 4: Document test results**

If issues found, note them for fixes. Otherwise, layout foundation is complete.

---

## Task 7: Add Pointer Event State to FloorplanCanvas

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte:48-60`

**Step 1: Add touch gesture state**

Add these state variables after the existing pan state (around line 56):

```typescript
// Zoom and pan state
let zoom = $state(1);
let panX = $state(0);
let panY = $state(0);
let isPanning = $state(false);
let lastPanPoint = $state<{ x: number; y: number } | null>(null);
let zoomLocked = $state(false);

// Touch gesture state
let pointers = $state(new Map<number, { x: number; y: number }>());
let lastPinchDistance = $state(0);
let lastPinchCenter = $state<{ x: number; y: number } | null>(null);
let isPinching = $state(false);
```

**Step 2: Update zoom constants**

Change the zoom constants to match PWA design:

```typescript
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;
```

**Step 3: Test file compiles**

Run: `bun check`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: add touch gesture state for pinch-to-zoom"
```

---

## Task 8: Implement Pointer Down Handler

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte` (add new function around line 350)

**Step 1: Add handlePointerDown function**

Add this function after the zoom functions (around line 350):

```typescript
function handlePointerDown(e: PointerEvent) {
  // Don't interfere with item dragging on desktop
  if (e.pointerType === 'mouse') return;

  const stage = stageRef?.node;
  if (!stage) return;

  const point = { x: e.clientX, y: e.clientY };
  pointers.set(e.pointerId, point);

  // If we now have 2 pointers, start pinch
  if (pointers.size === 2) {
    isPinching = true;
    isPanning = false;

    const [p1, p2] = Array.from(pointers.values());
    const distance = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
    lastPinchDistance = distance;
    lastPinchCenter = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  } else if (pointers.size === 1 && !readonly) {
    // Single touch - could be pan or item interaction
    // Let Konva handle item dragging
  }
}
```

**Step 2: Test file compiles**

Run: `bun check`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: implement pointer down handler for touch gestures"
```

---

## Task 9: Implement Pointer Move Handler

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte` (add new function)

**Step 1: Add handlePointerMove function**

Add after handlePointerDown:

```typescript
function handlePointerMove(e: PointerEvent) {
  if (e.pointerType === 'mouse') return;

  const stage = stageRef?.node;
  if (!stage) return;

  // Update pointer position
  const currentPointer = pointers.get(e.pointerId);
  if (!currentPointer) return;

  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // Handle pinch zoom with 2 fingers
  if (pointers.size === 2 && isPinching) {
    e.preventDefault();

    const [p1, p2] = Array.from(pointers.values());
    const distance = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
    const center = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };

    if (lastPinchDistance > 0 && lastPinchCenter) {
      // Calculate zoom change
      const scale = distance / lastPinchDistance;
      const oldZoom = zoom;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * scale));

      // Zoom toward pinch center
      const pinchPointTo = {
        x: (lastPinchCenter.x - panX) / oldZoom,
        y: (lastPinchCenter.y - panY) / oldZoom,
      };

      zoom = newZoom;
      panX = center.x - pinchPointTo.x * newZoom;
      panY = center.y - pinchPointTo.y * newZoom;
    }

    lastPinchDistance = distance;
    lastPinchCenter = center;
  } else if (pointers.size === 1 && !isPinching && !readonly) {
    // Single finger pan (only if not dragging an item)
    const isDraggingItem = draggingItemId !== null;
    if (!isDraggingItem) {
      const currentPoint = Array.from(pointers.values())[0];
      if (lastPanPoint) {
        const dx = currentPoint.x - lastPanPoint.x;
        const dy = currentPoint.y - lastPanPoint.y;
        panX += dx;
        panY += dy;
      }
      lastPanPoint = currentPoint;
    }
  }
}
```

**Step 2: Test file compiles**

Run: `bun check`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: implement pointer move handler for pinch-zoom and pan"
```

---

## Task 10: Implement Pointer Up Handler

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte` (add new function)

**Step 1: Add handlePointerUp function**

Add after handlePointerMove:

```typescript
function handlePointerUp(e: PointerEvent) {
  if (e.pointerType === 'mouse') return;

  pointers.delete(e.pointerId);

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
```

**Step 2: Test file compiles**

Run: `bun check`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: implement pointer up handler to reset gesture state"
```

---

## Task 11: Wire Up Touch Event Handlers to Container

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte:530-535`

**Step 1: Find the container div**

Locate the container div (around line 530) that currently has `onwheel={handleWheel}`.

**Step 2: Add pointer event handlers**

Update the container div:

```svelte
<div
  bind:this={containerEl}
  class="relative w-full h-full bg-slate-50 select-none"
  onwheel={handleWheel}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  style="touch-action: none;"
>
```

**Explanation:**
- `touch-action: none` prevents default touch gestures
- `onpointercancel` uses same handler as pointerup
- Pointer events work on all touch devices

**Step 3: Test file compiles**

Run: `bun check`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: wire up touch event handlers to canvas container"
```

---

## Task 12: Test Touch Gestures on Mobile

**Files:**
- Test only

**Step 1: Test pinch-to-zoom**

Run: `bun dev`

Open on mobile device or use Chrome DevTools touch emulation

Use two-finger pinch on canvas

Expected: Canvas zooms in/out smoothly

**Step 2: Test single-finger pan**

Use one finger to drag canvas

Expected: Canvas pans when not dragging an item

**Step 3: Test zoom limits**

Pinch out to max zoom (5x), pinch in to min zoom (0.5x)

Expected: Zoom stops at limits

**Step 4: Test conflict with item drag**

Try dragging an item with one finger

Expected: Item drags, canvas doesn't pan

**Step 5: Document any issues**

If gestures feel unnatural or conflict, note for refinement. Otherwise, gestures are working.

---

## Task 13: Install PWA Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install @vite-pwa/sveltekit**

Run: `bun add -D @vite-pwa/sveltekit`

Expected: Package installed and added to package.json

**Step 2: Verify installation**

Run: `bun check`

Expected: No errors

**Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "feat: install @vite-pwa/sveltekit for PWA support"
```

---

## Task 14: Configure PWA Plugin in SvelteKit

**Files:**
- Modify: `svelte.config.js`

**Step 1: Import SvelteKitPWA plugin**

Update svelte.config.js:

```javascript
import adapter from 'svelte-adapter-bun';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter()
  },
  plugins: [
    SvelteKitPWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      registerType: 'autoUpdate',
      manifest: false, // Use existing static/manifest.json
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ]
};

export default config;
```

**Step 2: Test build**

Run: `bun build`

Expected: Build succeeds (service worker warning is OK, we'll create it next)

**Step 3: Commit**

```bash
git add svelte.config.js
git commit -m "feat: configure SvelteKit PWA plugin"
```

---

## Task 15: Enhance PWA Manifest

**Files:**
- Modify: `static/manifest.json`

**Step 1: Add PWA enhancements to manifest**

Update static/manifest.json:

```json
{
  "name": "Floorplanner",
  "short_name": "Floorplanner",
  "description": "Create and share floor plans for your apartment",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#f1f5f9",
  "theme_color": "#4E74FF",
  "categories": ["productivity", "utilities"],
  "shortcuts": [
    {
      "name": "New Project",
      "url": "/",
      "description": "Create a new floor plan"
    }
  ],
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Step 2: Test manifest**

Run: `bun dev`

Open DevTools → Application → Manifest, verify all fields

Expected: All manifest fields displayed correctly

**Step 3: Commit**

```bash
git add static/manifest.json
git commit -m "feat: enhance PWA manifest with orientation and shortcuts"
```

---

## Task 16: Create Service Worker with Workbox

**Files:**
- Create: `src/service-worker.ts`

**Step 1: Create service worker file**

Create `src/service-worker.ts`:

```typescript
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Precache app shell (HTML, CSS, JS, fonts, icons)
precacheAndRoute(self.__WB_MANIFEST);

// Network-first for API calls (prefer fresh data, fallback to cache)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Cache-first for images (use cache, update in background)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Listen for skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

**Step 2: Test build**

Run: `bun build`

Expected: Build succeeds, service worker compiled

**Step 3: Commit**

```bash
git add src/service-worker.ts
git commit -m "feat: create service worker with Workbox caching strategies"
```

---

## Task 17: Test PWA Installation

**Files:**
- Test only

**Step 1: Test install prompt on desktop**

Run: `bun build && bun preview`

Open in Chrome, check for install button in address bar

Expected: Install button appears

**Step 2: Test manifest in DevTools**

Open DevTools → Application → Manifest

Expected: All fields correct, no errors

**Step 3: Test service worker registration**

Open DevTools → Application → Service Workers

Expected: Service worker registered and activated

**Step 4: Test offline mode**

Check "Offline" in DevTools → Network

Reload page

Expected: App loads from cache (local projects work)

**Step 5: Document PWA status**

PWA is installable and works offline for local projects.

---

## Task 18: Test on Actual Mobile Device

**Files:**
- Test only

**Step 1: Deploy to test environment**

Deploy app or use local network access

Access from mobile device

**Step 2: Test install flow on iOS**

Safari → Share → Add to Home Screen

Launch installed app

Expected: App opens in fullscreen, looks native

**Step 3: Test install flow on Android**

Chrome → Menu → Install app

Launch installed app

Expected: App opens in fullscreen, looks native

**Step 4: Test pinch-to-zoom on installed app**

Open floorplan, pinch to zoom

Expected: Smooth pinch-to-zoom, no browser zoom

**Step 5: Test safe area insets**

Check header/tabs on notched device

Expected: Content visible, not hidden behind notch/home indicator

**Step 6: Test offline functionality**

Enable airplane mode, open app

Create/view local projects

Expected: Fully functional offline

**Step 7: Document final test results**

If all tests pass, implementation is complete!

---

## Task 19: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add PWA section to CLAUDE.md**

Add after the "Mobile Experience" section:

```markdown
## PWA (Progressive Web App)

- App installable via "Add to Home Screen" on iOS/Android
- Works offline for local projects (service worker caching)
- Browser zoom disabled - use pinch-to-zoom on canvas instead
- Fixed header (top) and bottom tabs (mobile) with safe area insets
- Layout uses `100dvh` to handle mobile browser chrome

### Service Worker

- Built with @vite-pwa/sveltekit and Workbox
- Cache-first for app shell (HTML, CSS, JS, fonts, icons)
- Network-first for API routes
- Cache-first for images with 30-day expiration
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add PWA section to CLAUDE.md"
```

---

## Task 20: Final Build and Verification

**Files:**
- Test only

**Step 1: Clean build**

Run: `rm -rf .svelte-kit build && bun build`

Expected: Clean build succeeds

**Step 2: Run production preview**

Run: `bun preview`

Expected: App runs in production mode

**Step 3: Verify all features**

- [ ] Browser zoom disabled
- [ ] Header fixed at top with safe area
- [ ] Bottom tabs fixed with safe area
- [ ] Pinch-to-zoom works on canvas
- [ ] App installable
- [ ] Offline mode works for local projects
- [ ] No layout jumps on mobile

**Step 4: Final commit**

If everything works:

```bash
git add .
git commit -m "feat: complete mobile PWA experience implementation"
```

---

## Success Criteria

- [x] Browser zoom disabled, no accidental page zoom
- [x] Header stays fixed at top, tabs at bottom on mobile
- [x] Content scrolls smoothly between fixed elements
- [x] Pinch-to-zoom works naturally on canvas
- [x] App installable via "Add to Home Screen"
- [x] Local projects work fully offline
- [x] Safe areas handled on notched devices
- [x] No layout jumps when address bar hides/shows

## Notes

- Each task is independent and can be committed separately
- Test frequently on actual mobile devices, not just DevTools
- If pinch gesture conflicts with item dragging, adjust pointer event logic
- Service worker updates automatically on app close/reopen
