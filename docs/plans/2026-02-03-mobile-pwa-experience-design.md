# Mobile PWA Experience Design

**Date:** 2026-02-03
**Status:** Approved

## Overview

Transform the floorplanner into a native-feeling PWA with fixed navigation, canvas pinch-to-zoom, and offline support.

## Goals

1. **Disable browser zoom** - Use canvas pinch-to-zoom instead
2. **App-like layout** - Fixed header at top, fixed tabs at bottom
3. **PWA installability** - Add to home screen with offline support
4. **Native gestures** - Pinch-to-zoom and pan on canvas

## Architecture

### Core Changes

1. **Viewport Configuration** - Disable browser zoom, enable user-scalable viewport for canvas
2. **Fixed Layout** - Header at top, bottom tabs, content scrolls between
3. **Canvas Touch Gestures** - Implement pinch-to-zoom and pan on the canvas component
4. **PWA Enhancement** - Add service worker for offline support and installability
5. **Safe Area Support** - Handle notches/home indicators automatically

### Technical Stack

- No new dependencies for touch gestures (use native PointerEvent API)
- Workbox for service worker (via @vite-pwa/sveltekit)
- CSS `env(safe-area-inset-*)` for notch handling
- `user-scalable=no` to disable browser zoom

### Impact Areas

- `src/app.html` - viewport meta tag
- `src/routes/+layout.svelte` - layout structure changes
- `src/routes/projects/[id]/+page.svelte` - layout class adjustments
- `src/lib/components/canvas/FloorplanCanvas.svelte` - touch gesture handling
- `src/lib/components/layout/MobileNav.svelte` - safe area insets
- New: `src/service-worker.ts` - offline support
- `svelte.config.js` - PWA plugin configuration
- `static/manifest.json` - PWA enhancements

## Detailed Design

### 1. Viewport & PWA Configuration

#### Viewport Meta Tag (`src/app.html`)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
```

**Key attributes:**
- `user-scalable=no` - Disables browser pinch-to-zoom
- `maximum-scale=1` - Prevents zoom on input focus (iOS)
- `viewport-fit=cover` - Extends content into safe areas (notches)

#### Manifest Enhancements (`static/manifest.json`)

```json
{
  "display": "standalone",
  "orientation": "any",
  "categories": ["productivity", "utilities"],
  "shortcuts": [
    {
      "name": "New Project",
      "url": "/",
      "description": "Create a new floor plan"
    }
  ]
}
```

#### iOS-Specific Meta Tags (`src/routes/+layout.svelte`)

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

### 2. Layout Structure (Fixed Header/Tabs)

#### Layout Container (`src/routes/+layout.svelte`)

```svelte
<div class="h-screen bg-slate-100 flex flex-col overflow-hidden" style="height: 100dvh;">
  {@render children()}
</div>
```

**Key change:** Use `100dvh` (dynamic viewport height)
- Accounts for mobile browser chrome appearing/disappearing
- Prevents layout jumps when address bar hides

#### Project Page Structure (`src/routes/projects/[id]/+page.svelte`)

```svelte
<!-- Fixed Header: h-14 (56px) -->
<header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0"
        style="padding-top: env(safe-area-inset-top);">
  <!-- existing header content -->
</header>

<!-- Scrollable Content: flex-1 fills space between header and tabs -->
<main class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
  <!-- Canvas/List content -->
</main>

<!-- Fixed Bottom Tabs: h-14 (56px), only on mobile -->
<MobileNav {activeTab} onTabChange={(tab) => (activeTab = tab)} />
```

#### MobileNav Update (`src/lib/components/layout/MobileNav.svelte`)

```svelte
<nav class="h-14 bg-white border-t border-slate-200 flex md:hidden flex-shrink-0"
     style="padding-bottom: env(safe-area-inset-bottom);">
  <!-- existing tab buttons -->
</nav>
```

**Safe Area Insets:**
- Top padding on header for iPhone notch
- Bottom padding on tabs for home indicator
- Only applies on devices with notches/indicators

### 3. Canvas Pinch-to-Zoom Implementation

#### Touch Gesture Strategy (`src/lib/components/canvas/FloorplanCanvas.svelte`)

**Gesture Detection:**
- Use `PointerEvent` API (modern, works on all touch devices)
- Track multiple touch points for pinch detection
- Separate handling: 1-finger pan, 2-finger pinch-zoom, item drag

**Gesture State Management:**

```typescript
let pointers = new Map<number, { x: number; y: number }>();
let lastDistance = 0;
let lastCenter = { x: 0, y: 0 };
let isPinching = false;
```

**Event Flow:**

```
pointerdown → Track finger position(s)
  ↓
pointermove → 1 finger? Pan canvas
              2 fingers? Calculate distance & zoom
  ↓
pointerup → Clear tracking, reset state
```

**Zoom Behavior:**
- Zoom centered on pinch midpoint (natural feel)
- Min zoom: 0.5x (see more of floorplan)
- Max zoom: 5x (see fine details)
- Smooth zoom with `requestAnimationFrame`

**Conflict Resolution:**
- Disable item dragging while pinching
- `touch-action: none` on canvas to prevent default gestures
- Check `pointers.size` to determine gesture type

**Desktop Compatibility:**
- Keep existing mouse wheel zoom
- Mouse drag for pan (unchanged)
- Touch gestures only active on touch devices

### 4. Service Worker & Offline Support

#### Caching Strategy

- **App Shell** (cache-first): HTML, CSS, JS, fonts, icons
- **API Routes** (network-first): `/api/*` endpoints
- **Images** (cache-first with expiration): Floorplan images, thumbnails
- **Static Assets** (cache-first): Icons, manifest

#### Dependencies

```bash
bun add -D @vite-pwa/sveltekit
```

#### PWA Plugin Configuration (`svelte.config.js`)

```javascript
import { SvelteKitPWA } from '@vite-pwa/sveltekit'

const config = {
  kit: {
    adapter: adapter(),
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
}
```

#### Service Worker Logic (`src/service-worker.ts`)

```typescript
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

// Precache app shell
precacheAndRoute(self.__WB_MANIFEST);

// Network-first for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api-cache' })
);

// Cache-first for images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({ cacheName: 'image-cache' })
);
```

#### Offline Behavior

- **Local projects:** Fully functional offline (already in IndexedDB)
- **Cloud projects:** Show cached data with "offline" indicator
- **New projects:** Can create offline, sync when online

#### Update Strategy

- Silent auto-update when app is closed
- Optional: Toast notification "New version available"

## Implementation Plan

### Phase 1: Viewport & Layout Foundation

1. Update `src/app.html` viewport meta tag
2. Change `src/routes/+layout.svelte` to use `100dvh`
3. Add safe area insets to header and MobileNav
4. Test layout on mobile (fixed header/tabs, scrolling content)

**Expected outcome:** Fixed navigation layout works on mobile

### Phase 2: Canvas Touch Gestures

1. Add pointer event handlers to FloorplanCanvas
2. Implement pinch-to-zoom detection and calculation
3. Add pan gesture for single-finger drag
4. Set `touch-action: none` on canvas element
5. Test: pinch zoom, pan, item interaction on touch device

**Expected outcome:** Natural pinch-to-zoom and pan on canvas

### Phase 3: PWA Configuration

1. Install `@vite-pwa/sveltekit` and `workbox` dependencies
2. Update `svelte.config.js` with PWA plugin
3. Enhance `static/manifest.json` (orientation, shortcuts)
4. Add iOS meta tags to `+layout.svelte`
5. Test manifest in Chrome DevTools

**Expected outcome:** App can be installed to home screen

### Phase 4: Service Worker & Offline

1. Create `src/service-worker.ts` with Workbox
2. Configure caching strategies (app shell, API, images)
3. Test offline mode in DevTools
4. Verify install prompt appears on mobile

**Expected outcome:** App works offline for local projects

### Phase 5: Testing & Polish

1. Test on actual mobile device (not just desktop DevTools)
2. Verify pinch-to-zoom feels natural
3. Check safe area insets on notched devices
4. Test install flow on iOS and Android
5. Verify offline functionality

**Expected outcome:** Production-ready mobile PWA experience

## Complexity Assessment

- **Phase 1-2:** Medium (layout + gestures are core changes)
- **Phase 3-4:** Low (mostly configuration)
- **Phase 5:** Low (testing and tweaks)

## Rollback Safety

- Each phase is independent
- Can commit after each phase
- Easy to revert if issues found

## Success Criteria

- [ ] Browser zoom disabled, no accidental page zoom
- [ ] Header stays fixed at top, tabs at bottom on mobile
- [ ] Content scrolls smoothly between fixed elements
- [ ] Pinch-to-zoom works naturally on canvas
- [ ] App installable via "Add to Home Screen"
- [ ] Local projects work fully offline
- [ ] Safe areas handled on notched devices
- [ ] No layout jumps when address bar hides/shows
