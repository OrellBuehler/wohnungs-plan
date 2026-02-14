# Apartment Planner Application Design

## Overview

A responsive web application for apartment planning. Users upload their floorplan, set a scale, and place furniture/objects to see if they fit. Includes a list view showing item costs and product links.

## Tech Stack

- **Framework:** SvelteKit (with TypeScript)
- **Runtime:** Bun
- **Canvas:** Konva.js via `svelte-konva`
- **Styling:** TailwindCSS + shadcn-svelte
- **Storage:** IndexedDB (via `idb` library) + JSON export/import

## Core Features

### Floorplan Management
- Upload floorplan image (drag-drop or file picker)
- Set scale by drawing a reference line and entering its real-world length in cm
- Image stored as base64 in project data

### Item Management
- Manual entry for each item: name, dimensions (W×H in cm), color, price, product URL
- Items can be placed on canvas or remain unplaced
- List view shows all items with totals

### Canvas Interactions
- **Place:** Drag item from list onto canvas, or click item then click canvas
- **Select:** Click item on canvas to show transform handles
- **Move:** Drag selected item
- **Resize:** Drag corner handles (aspect ratio maintained by default, Shift for free resize)
- **Rotate:** Rotation handle or 90° increment buttons
- **Duplicate:** Button or Ctrl+D
- **Delete:** Button or Delete key
- **Snap:** Grid snap (toggleable, configurable size), snap to other items' edges
- **Overlap detection:** Items turn red when overlapping (non-blocking)

### Canvas Controls
- Zoom: scroll wheel, pinch on mobile, or +/- buttons
- Pan: drag empty space, two-finger drag on mobile

### Data Persistence
- **IndexedDB:** Primary storage, auto-save on changes (debounced)
- **Multiple projects:** List, create, rename, delete
- **JSON export:** Download project as `.json` file
- **JSON import:** Load project from `.json` file

## Data Model

```typescript
interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  floorplan: Floorplan
  items: Item[]
}

interface Floorplan {
  imageData: string        // Base64 encoded image
  scale: number            // Pixels per centimeter
  referenceLength: number  // Real-world cm used to calibrate scale
}

interface Item {
  id: string
  name: string
  width: number            // Centimeters
  height: number           // Centimeters (depth on 2D floorplan)
  color: string            // Hex color for visual distinction
  price: number | null
  productUrl: string | null
  position: { x: number; y: number } | null  // Null if not placed on canvas
  rotation: number         // Degrees
}
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── canvas/           # Floorplan editor components
│   │   │   ├── FloorplanCanvas.svelte
│   │   │   ├── CanvasItem.svelte
│   │   │   ├── ScaleCalibration.svelte
│   │   │   └── CanvasControls.svelte
│   │   ├── ui/               # shadcn-svelte components
│   │   └── items/            # Item list/form components
│   │       ├── ItemList.svelte
│   │       ├── ItemForm.svelte
│   │       └── ItemCard.svelte
│   ├── stores/
│   │   ├── project.svelte.ts # Main project store
│   │   └── settings.svelte.ts
│   ├── db/
│   │   └── index.ts          # IndexedDB operations
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── utils/
│       ├── export.ts         # JSON export/import
│       └── geometry.ts       # Overlap detection, snapping
├── routes/
│   ├── +page.svelte          # Main app (single page)
│   └── +layout.svelte        # App shell
└── app.css                   # Tailwind + custom styles
```

## UI Layout

### Desktop (≥768px)

```
┌─────────────────────────────────────────────────────┐
│  Header: Project Name           [Menu] [Settings]   │
├─────────────────────────────────┬───────────────────┤
│                                 │  Item List        │
│                                 │  ────────────────│
│      Floorplan Canvas           │  • Sofa 200×90   │
│      (zoomable, pannable)       │  • Bed 140×200   │
│                                 │  • Desk 120×60   │
│                                 │  ────────────────│
│                                 │  [+ Add Item]    │
│                                 │  Total: €1,234   │
├─────────────────────────────────┴───────────────────┤
│  Canvas controls: [Zoom +/-] [Grid ✓] [Snap ✓]      │
└─────────────────────────────────────────────────────┘
```

### Mobile (<768px)

```
┌────────────────────────┐
│  Project Name    [≡]   │
├────────────────────────┤
│                        │
│   Floorplan Canvas     │
│   (or Item List)       │
│                        │
├────────────────────────┤
│  [🗺 Plan] [📋 Items]   │  ← Tab bar
└────────────────────────┘
```

## Aesthetic Direction: "Scandinavian Blueprint"

A clean, architectural aesthetic that feels like a modern architect's drafting table.

### Colors
- **Canvas background:** Deep slate (`#1e293b`)
- **Grid lines:** Subtle white (`rgba(255,255,255,0.1)`)
- **Furniture items:** Warm wood tones (`#D4A574`, `#B8956E`)
- **Selection highlight:** Soft blue (`#60A5FA`)
- **Overlap warning:** Muted red (`#F87171` at 50% opacity)
- **UI background:** Off-white (`#F8FAFC`)
- **UI text:** Charcoal (`#334155`)

### Typography
- **Display/Headers:** DM Sans (geometric, modern)
- **Measurements/Technical:** JetBrains Mono (precise, monospace)
- **Body:** DM Sans

### Visual Details
- Subtle paper/blueprint texture on canvas
- Measurement annotations appear on hover
- Items cast soft shadows
- Crisp, precise grid lines
- Minimal but refined UI chrome

## Dependencies

```json
{
  "dependencies": {
    "konva": "^9.x",
    "svelte-konva": "^1.x",
    "idb": "^8.x"
  },
  "devDependencies": {
    "@sveltejs/kit": "^2.x",
    "svelte": "^5.x",
    "typescript": "^5.x",
    "tailwindcss": "^3.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x"
  }
}
```

## Setup Commands

```bash
# Create SvelteKit project
bun x sv create wohnungs-plan
cd wohnungs-plan

# Install canvas library
bun add svelte-konva konva

# Install IndexedDB wrapper
bun add idb

# Initialize shadcn-svelte (includes Tailwind setup)
bun x shadcn-svelte@latest init

# Add shadcn components
bun x shadcn-svelte@latest add button input label card dialog sheet dropdown-menu tabs slider
```

## Out of Scope (v1)

- User accounts / cloud sync
- Preset furniture library
- Undo/redo history
- Multiple floors
- 3D view
- Collaboration features
- Import from retailers (IKEA, etc.)

## Future Considerations

The SvelteKit architecture allows easy addition of:
- API routes for backend features
- Authentication (when cloud sync is added)
- Server-side rendering for SEO (if needed)
