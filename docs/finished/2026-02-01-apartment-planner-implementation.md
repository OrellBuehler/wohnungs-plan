# Apartment Planner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a responsive web app for planning apartment furniture layouts with floorplan upload, item placement, and cost tracking.

**Architecture:** SvelteKit SPA with Konva.js canvas for the floorplan editor. Svelte 5 runes for state management. IndexedDB for persistence with JSON export/import.

**Tech Stack:** SvelteKit, Bun, svelte-konva, Konva.js, TailwindCSS, shadcn-svelte, idb, TypeScript

---

## Task 1: Project Setup

**Files:**
- Create: Project scaffolding via CLI
- Modify: `package.json`, `svelte.config.js`, `app.css`

**Step 1: Create SvelteKit project with Bun**

```bash
cd /home/orell/github/wohnungs-plan
bun x sv create . --template minimal --types ts --no-add-ons --no-install
```

Select: Yes to install in current directory (overwrite)

**Step 2: Install dependencies**

```bash
bun install
```

**Step 3: Verify project runs**

```bash
bun run dev
```

Expected: Server starts at http://localhost:5173

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project with TypeScript"
```

---

## Task 2: Add TailwindCSS and shadcn-svelte

**Files:**
- Modify: `svelte.config.js`, `vite.config.ts`, `src/app.css`
- Create: `tailwind.config.js`, `postcss.config.js`, `components.json`

**Step 1: Initialize shadcn-svelte (includes Tailwind)**

```bash
bun x shadcn-svelte@latest init
```

Select options:
- Style: Default
- Base color: Slate
- CSS variables: Yes
- Global CSS path: src/app.css
- Tailwind config: tailwind.config.js
- Components path: $lib/components/ui
- Utils path: $lib/utils

**Step 2: Add required shadcn components**

```bash
bun x shadcn-svelte@latest add button input label card dialog sheet tabs slider dropdown-menu separator
```

**Step 3: Verify Tailwind works**

Edit `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
</script>

<main class="min-h-screen bg-slate-100 p-8">
  <h1 class="text-3xl font-bold text-slate-800 mb-4">Wohnungs-Plan</h1>
  <Button>Test Button</Button>
</main>
```

**Step 4: Run and verify styling**

```bash
bun run dev
```

Expected: Page shows styled heading and button

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add TailwindCSS and shadcn-svelte components"
```

---

## Task 3: Add Custom Fonts and Base Styles

**Files:**
- Modify: `src/app.html`, `src/app.css`

**Step 1: Add Google Fonts to app.html**

Edit `src/app.html`, add in `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Step 2: Configure fonts in Tailwind**

Edit `tailwind.config.js`, extend theme:

```js
theme: {
  extend: {
    fontFamily: {
      sans: ['DM Sans', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
    colors: {
      canvas: {
        bg: '#1e293b',
        grid: 'rgba(255,255,255,0.1)',
      },
      wood: {
        DEFAULT: '#D4A574',
        dark: '#B8956E',
      },
    },
  },
},
```

**Step 3: Add base styles to app.css**

Append to `src/app.css`:

```css
body {
  font-family: 'DM Sans', system-ui, sans-serif;
}

.font-technical {
  font-family: 'JetBrains Mono', monospace;
}
```

**Step 4: Verify fonts render**

```bash
bun run dev
```

Expected: Heading uses DM Sans font

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add DM Sans and JetBrains Mono fonts"
```

---

## Task 4: Define TypeScript Types

**Files:**
- Create: `src/lib/types/index.ts`

**Step 1: Create types file**

Create `src/lib/types/index.ts`:

```typescript
export interface Position {
  x: number;
  y: number;
}

export interface Floorplan {
  imageData: string;        // Base64 encoded image
  scale: number;            // Pixels per centimeter
  referenceLength: number;  // Real-world cm used to calibrate
}

export interface Item {
  id: string;
  name: string;
  width: number;            // Centimeters
  height: number;           // Centimeters
  color: string;            // Hex color
  price: number | null;
  productUrl: string | null;
  position: Position | null; // Null if not placed
  rotation: number;         // Degrees
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  floorplan: Floorplan | null;
  items: Item[];
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Commit**

```bash
git add src/lib/types/index.ts
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 5: Set Up IndexedDB Storage

**Files:**
- Create: `src/lib/db/index.ts`

**Step 1: Install idb library**

```bash
bun add idb
```

**Step 2: Create database module**

Create `src/lib/db/index.ts`:

```typescript
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, ProjectMeta } from '$lib/types';

interface WohnungsPlanDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': string };
  };
}

let dbPromise: Promise<IDBPDatabase<WohnungsPlanDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<WohnungsPlanDB>('wohnungs-plan', 1, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

export async function getAllProjects(): Promise<ProjectMeta[]> {
  const db = await getDB();
  const projects = await db.getAllFromIndex('projects', 'by-updated');
  return projects.reverse().map(({ id, name, createdAt, updatedAt }) => ({
    id,
    name,
    createdAt,
    updatedAt,
  }));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  project.updatedAt = new Date().toISOString();
  await db.put('projects', project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

export function createNewProject(name: string = 'Untitled Project'): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    floorplan: null,
    items: [],
  };
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add IndexedDB storage layer"
```

---

## Task 6: Create Project Store

**Files:**
- Create: `src/lib/stores/project.svelte.ts`

**Step 1: Create Svelte 5 runes-based store**

Create `src/lib/stores/project.svelte.ts`:

```typescript
import type { Project, Item, Floorplan, Position } from '$lib/types';
import { saveProject, createNewProject } from '$lib/db';

let currentProject = $state<Project | null>(null);
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function debounceAutoSave() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  if (currentProject) {
    autoSaveTimeout = setTimeout(() => {
      if (currentProject) {
        saveProject(currentProject);
      }
    }, 1000);
  }
}

export function getProject() {
  return currentProject;
}

export function setProject(project: Project | null) {
  currentProject = project;
}

export function createProject(name?: string) {
  currentProject = createNewProject(name);
  saveProject(currentProject);
  return currentProject;
}

export function updateProjectName(name: string) {
  if (currentProject) {
    currentProject.name = name;
    debounceAutoSave();
  }
}

export function setFloorplan(floorplan: Floorplan) {
  if (currentProject) {
    currentProject.floorplan = floorplan;
    debounceAutoSave();
  }
}

export function addItem(item: Omit<Item, 'id'>) {
  if (currentProject) {
    const newItem: Item = {
      ...item,
      id: crypto.randomUUID(),
    };
    currentProject.items = [...currentProject.items, newItem];
    debounceAutoSave();
    return newItem;
  }
  return null;
}

export function updateItem(id: string, updates: Partial<Item>) {
  if (currentProject) {
    currentProject.items = currentProject.items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    debounceAutoSave();
  }
}

export function deleteItem(id: string) {
  if (currentProject) {
    currentProject.items = currentProject.items.filter((item) => item.id !== id);
    debounceAutoSave();
  }
}

export function updateItemPosition(id: string, position: Position | null) {
  updateItem(id, { position });
}

export function updateItemRotation(id: string, rotation: number) {
  updateItem(id, { rotation });
}

export function duplicateItem(id: string) {
  if (currentProject) {
    const item = currentProject.items.find((i) => i.id === id);
    if (item) {
      const newItem: Item = {
        ...item,
        id: crypto.randomUUID(),
        position: item.position
          ? { x: item.position.x + 20, y: item.position.y + 20 }
          : null,
      };
      currentProject.items = [...currentProject.items, newItem];
      debounceAutoSave();
      return newItem;
    }
  }
  return null;
}

export function getItems() {
  return currentProject?.items ?? [];
}

export function getPlacedItems() {
  return (currentProject?.items ?? []).filter((item) => item.position !== null);
}

export function getUnplacedItems() {
  return (currentProject?.items ?? []).filter((item) => item.position === null);
}

export function getTotalCost() {
  return (currentProject?.items ?? []).reduce(
    (sum, item) => sum + (item.price ?? 0),
    0
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/stores/project.svelte.ts
git commit -m "feat: add reactive project store with auto-save"
```

---

## Task 7: Create JSON Export/Import Utilities

**Files:**
- Create: `src/lib/utils/export.ts`

**Step 1: Create export utilities**

Create `src/lib/utils/export.ts`:

```typescript
import type { Project } from '$lib/types';

export function exportProjectToJSON(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function downloadProject(project: Project) {
  const json = exportProjectToJSON(project);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importProjectFromJSON(json: string): Project | null {
  try {
    const data = JSON.parse(json);
    // Basic validation
    if (!data.id || !data.name || !Array.isArray(data.items)) {
      throw new Error('Invalid project format');
    }
    // Assign new ID to avoid conflicts
    data.id = crypto.randomUUID();
    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();
    return data as Project;
  } catch {
    return null;
  }
}

export async function readFileAsJSON(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/utils/export.ts
git commit -m "feat: add JSON export/import utilities"
```

---

## Task 8: Install and Configure Konva

**Files:**
- Modify: `package.json`

**Step 1: Install svelte-konva and konva**

```bash
bun add svelte-konva konva
```

**Step 2: Verify installation**

Create a simple test in `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { Stage, Layer, Rect } from 'svelte-konva';
</script>

<main class="min-h-screen bg-slate-100 p-8">
  <h1 class="text-3xl font-bold text-slate-800 mb-4">Wohnungs-Plan</h1>
  <div class="bg-canvas-bg rounded-lg overflow-hidden" style="width: 600px; height: 400px;">
    <Stage width={600} height={400}>
      <Layer>
        <Rect x={50} y={50} width={100} height={80} fill="#D4A574" draggable />
      </Layer>
    </Stage>
  </div>
</main>
```

**Step 3: Run and verify canvas works**

```bash
bun run dev
```

Expected: Blue rectangle that can be dragged

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add svelte-konva for canvas rendering"
```

---

## Task 9: Create App Layout Shell

**Files:**
- Create: `src/lib/components/layout/Header.svelte`
- Create: `src/lib/components/layout/MobileNav.svelte`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`

**Step 1: Create Header component**

Create `src/lib/components/layout/Header.svelte`:

```svelte
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

  interface Props {
    projectName: string;
    onRename: () => void;
    onNew: () => void;
    onOpen: () => void;
    onExport: () => void;
    onImport: () => void;
  }

  let { projectName, onRename, onNew, onOpen, onExport, onImport }: Props = $props();
</script>

<header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
  <button
    class="text-lg font-semibold text-slate-800 hover:text-slate-600 transition-colors"
    onclick={onRename}
  >
    {projectName}
  </button>

  <div class="flex items-center gap-2">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild let:builder>
        <Button builders={[builder]} variant="outline" size="sm">Menu</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onclick={onNew}>New Project</DropdownMenu.Item>
        <DropdownMenu.Item onclick={onOpen}>Open Project</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onclick={onExport}>Export JSON</DropdownMenu.Item>
        <DropdownMenu.Item onclick={onImport}>Import JSON</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</header>
```

**Step 2: Create MobileNav component**

Create `src/lib/components/layout/MobileNav.svelte`:

```svelte
<script lang="ts">
  interface Props {
    activeTab: 'plan' | 'items';
    onTabChange: (tab: 'plan' | 'items') => void;
  }

  let { activeTab, onTabChange }: Props = $props();
</script>

<nav class="h-14 bg-white border-t border-slate-200 flex md:hidden">
  <button
    class="flex-1 flex items-center justify-center gap-2 {activeTab === 'plan'
      ? 'text-blue-600 bg-blue-50'
      : 'text-slate-600'}"
    onclick={() => onTabChange('plan')}
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
    <span class="text-sm font-medium">Plan</span>
  </button>
  <button
    class="flex-1 flex items-center justify-center gap-2 {activeTab === 'items'
      ? 'text-blue-600 bg-blue-50'
      : 'text-slate-600'}"
    onclick={() => onTabChange('items')}
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
    <span class="text-sm font-medium">Items</span>
  </button>
</nav>
```

**Step 3: Update +layout.svelte**

Edit `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import "../app.css";
  let { children } = $props();
</script>

<div class="min-h-screen bg-slate-100 flex flex-col">
  {@render children()}
</div>
```

**Step 4: Update +page.svelte with layout structure**

Edit `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import Header from "$lib/components/layout/Header.svelte";
  import MobileNav from "$lib/components/layout/MobileNav.svelte";

  let projectName = $state("My Apartment");
  let activeTab = $state<'plan' | 'items'>('plan');

  function handleRename() {
    const newName = prompt("Enter project name:", projectName);
    if (newName) projectName = newName;
  }
</script>

<Header
  {projectName}
  onRename={handleRename}
  onNew={() => console.log('new')}
  onOpen={() => console.log('open')}
  onExport={() => console.log('export')}
  onImport={() => console.log('import')}
/>

<main class="flex-1 flex flex-col md:flex-row overflow-hidden">
  <!-- Canvas area -->
  <div class="flex-1 {activeTab === 'plan' ? 'flex' : 'hidden'} md:flex flex-col">
    <div class="flex-1 bg-canvas-bg m-2 md:m-4 rounded-lg overflow-hidden">
      <p class="text-white p-4">Canvas will go here</p>
    </div>
  </div>

  <!-- Item list sidebar -->
  <aside class="w-full md:w-80 {activeTab === 'items' ? 'flex' : 'hidden'} md:flex flex-col bg-white border-l border-slate-200">
    <div class="p-4 border-b border-slate-200">
      <h2 class="font-semibold text-slate-800">Items</h2>
    </div>
    <div class="flex-1 overflow-y-auto p-4">
      <p class="text-slate-500 text-sm">No items yet</p>
    </div>
    <div class="p-4 border-t border-slate-200">
      <p class="text-sm text-slate-600">Total: €0.00</p>
    </div>
  </aside>
</main>

<MobileNav {activeTab} onTabChange={(tab) => (activeTab = tab)} />
```

**Step 5: Run and verify layout**

```bash
bun run dev
```

Expected: Header with menu, dark canvas area, sidebar, mobile tab bar (on narrow viewport)

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add responsive app layout shell"
```

---

## Task 10: Create Floorplan Canvas Component

**Files:**
- Create: `src/lib/components/canvas/FloorplanCanvas.svelte`

**Step 1: Create the canvas component**

Create `src/lib/components/canvas/FloorplanCanvas.svelte`:

```svelte
<script lang="ts">
  import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'svelte-konva';
  import type { Item, Floorplan } from '$lib/types';
  import Konva from 'konva';

  interface Props {
    floorplan: Floorplan | null;
    items: Item[];
    selectedItemId: string | null;
    gridSize: number;
    showGrid: boolean;
    snapToGrid: boolean;
    onItemSelect: (id: string | null) => void;
    onItemMove: (id: string, x: number, y: number) => void;
    onItemTransform: (id: string, width: number, height: number, rotation: number) => void;
  }

  let {
    floorplan,
    items,
    selectedItemId,
    gridSize = 50,
    showGrid = true,
    snapToGrid = true,
    onItemSelect,
    onItemMove,
    onItemTransform,
  }: Props = $props();

  let containerEl: HTMLDivElement;
  let stageWidth = $state(800);
  let stageHeight = $state(600);
  let transformer: { node: Konva.Transformer } | undefined;
  let floorplanImage: HTMLImageElement | null = $state(null);

  // Load floorplan image
  $effect(() => {
    if (floorplan?.imageData) {
      const img = new Image();
      img.onload = () => {
        floorplanImage = img;
      };
      img.src = floorplan.imageData;
    } else {
      floorplanImage = null;
    }
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

  // Update transformer when selection changes
  $effect(() => {
    // This will be handled by shape refs
  });

  function snapValue(value: number): number {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }

  function handleStageClick(e: CustomEvent) {
    const clickedOnEmpty = e.detail.target === e.detail.target.getStage();
    if (clickedOnEmpty) {
      onItemSelect(null);
    }
  }

  function handleDragEnd(itemId: string, e: CustomEvent) {
    const node = e.detail.target;
    const x = snapValue(node.x());
    const y = snapValue(node.y());
    node.x(x);
    node.y(y);
    onItemMove(itemId, x, y);
  }

  function handleTransformEnd(itemId: string, e: CustomEvent) {
    const node = e.detail.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and apply to dimensions
    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(20, node.width() * scaleX);
    const newHeight = Math.max(20, node.height() * scaleY);
    const rotation = node.rotation();

    onItemTransform(itemId, newWidth, newHeight, rotation);
  }

  // Convert cm to pixels using scale
  function cmToPixels(cm: number): number {
    if (!floorplan?.scale) return cm * 2; // Default fallback
    return cm * floorplan.scale;
  }
</script>

<div bind:this={containerEl} class="w-full h-full">
  <Stage
    width={stageWidth}
    height={stageHeight}
    onclick={handleStageClick}
  >
    <Layer>
      <!-- Grid -->
      {#if showGrid}
        {#each Array(Math.ceil(stageWidth / gridSize)) as _, i}
          <Rect
            x={i * gridSize}
            y={0}
            width={1}
            height={stageHeight}
            fill="rgba(255,255,255,0.1)"
          />
        {/each}
        {#each Array(Math.ceil(stageHeight / gridSize)) as _, i}
          <Rect
            x={0}
            y={i * gridSize}
            width={stageWidth}
            height={1}
            fill="rgba(255,255,255,0.1)"
          />
        {/each}
      {/if}

      <!-- Floorplan image -->
      {#if floorplanImage}
        <KonvaImage
          image={floorplanImage}
          x={0}
          y={0}
          width={stageWidth}
          height={stageHeight}
          opacity={0.8}
        />
      {/if}
    </Layer>

    <Layer>
      <!-- Furniture items -->
      {#each items.filter(i => i.position) as item (item.id)}
        <Rect
          x={item.position!.x}
          y={item.position!.y}
          width={cmToPixels(item.width)}
          height={cmToPixels(item.height)}
          fill={item.color}
          rotation={item.rotation}
          draggable
          shadowColor="black"
          shadowBlur={10}
          shadowOpacity={0.3}
          shadowOffset={{ x: 4, y: 4 }}
          stroke={selectedItemId === item.id ? '#60A5FA' : 'transparent'}
          strokeWidth={2}
          onclick={() => onItemSelect(item.id)}
          ondragend={(e) => handleDragEnd(item.id, e)}
          ontransformend={(e) => handleTransformEnd(item.id, e)}
        />
      {/each}

      <!-- Transformer for selected item -->
      {#if selectedItemId}
        <Transformer
          bind:this={transformer}
          rotationSnaps={[0, 90, 180, 270]}
          rotationSnapTolerance={15}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
        />
      {/if}
    </Layer>
  </Stage>
</div>
```

**Step 2: Commit**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: add FloorplanCanvas component with grid and items"
```

---

## Task 11: Create Item List Components

**Files:**
- Create: `src/lib/components/items/ItemCard.svelte`
- Create: `src/lib/components/items/ItemList.svelte`

**Step 1: Create ItemCard component**

Create `src/lib/components/items/ItemCard.svelte`:

```svelte
<script lang="ts">
  import type { Item } from '$lib/types';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    item: Item;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
  }

  let { item, isSelected, onSelect, onEdit, onDelete, onDuplicate }: Props = $props();
</script>

<div
  class="p-3 rounded-lg border transition-colors cursor-pointer {isSelected
    ? 'border-blue-500 bg-blue-50'
    : 'border-slate-200 hover:border-slate-300 bg-white'}"
  onclick={onSelect}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Enter' && onSelect()}
>
  <div class="flex items-start gap-3">
    <!-- Color swatch -->
    <div
      class="w-8 h-8 rounded flex-shrink-0"
      style="background-color: {item.color}"
    ></div>

    <div class="flex-1 min-w-0">
      <h3 class="font-medium text-slate-800 truncate">{item.name}</h3>
      <p class="text-sm text-slate-500 font-mono">
        {item.width} × {item.height} cm
      </p>
      {#if item.price !== null}
        <p class="text-sm font-medium text-slate-700">€{item.price.toFixed(2)}</p>
      {/if}
    </div>

    <div class="flex flex-col gap-1">
      {#if item.position}
        <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Placed</span>
      {:else}
        <span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Unplaced</span>
      {/if}
      {#if item.productUrl}
        <a
          href={item.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-blue-600 hover:underline"
          onclick={(e) => e.stopPropagation()}
        >
          View product
        </a>
      {/if}
    </div>
  </div>

  {#if isSelected}
    <div class="flex gap-2 mt-3 pt-3 border-t border-slate-200">
      <Button size="sm" variant="outline" onclick={(e) => { e.stopPropagation(); onEdit(); }}>
        Edit
      </Button>
      <Button size="sm" variant="outline" onclick={(e) => { e.stopPropagation(); onDuplicate(); }}>
        Duplicate
      </Button>
      <Button size="sm" variant="destructive" onclick={(e) => { e.stopPropagation(); onDelete(); }}>
        Delete
      </Button>
    </div>
  {/if}
</div>
```

**Step 2: Create ItemList component**

Create `src/lib/components/items/ItemList.svelte`:

```svelte
<script lang="ts">
  import type { Item } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import ItemCard from './ItemCard.svelte';

  interface Props {
    items: Item[];
    selectedItemId: string | null;
    totalCost: number;
    onItemSelect: (id: string | null) => void;
    onItemEdit: (id: string) => void;
    onItemDelete: (id: string) => void;
    onItemDuplicate: (id: string) => void;
    onAddItem: () => void;
  }

  let {
    items,
    selectedItemId,
    totalCost,
    onItemSelect,
    onItemEdit,
    onItemDelete,
    onItemDuplicate,
    onAddItem,
  }: Props = $props();

  let sortBy = $state<'name' | 'price' | 'status'>('name');
  let filterBy = $state<'all' | 'placed' | 'unplaced'>('all');

  const filteredItems = $derived(() => {
    let result = [...items];

    // Filter
    if (filterBy === 'placed') {
      result = result.filter(i => i.position !== null);
    } else if (filterBy === 'unplaced') {
      result = result.filter(i => i.position === null);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') return (b.price ?? 0) - (a.price ?? 0);
      if (sortBy === 'status') {
        const aPlaced = a.position !== null ? 1 : 0;
        const bPlaced = b.position !== null ? 1 : 0;
        return bPlaced - aPlaced;
      }
      return 0;
    });

    return result;
  });
</script>

<div class="flex flex-col h-full">
  <div class="p-4 border-b border-slate-200">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-semibold text-slate-800">Items ({items.length})</h2>
      <Button size="sm" onclick={onAddItem}>+ Add</Button>
    </div>

    <div class="flex gap-2 text-sm">
      <select
        class="px-2 py-1 rounded border border-slate-200 text-slate-600"
        bind:value={filterBy}
      >
        <option value="all">All</option>
        <option value="placed">Placed</option>
        <option value="unplaced">Unplaced</option>
      </select>
      <select
        class="px-2 py-1 rounded border border-slate-200 text-slate-600"
        bind:value={sortBy}
      >
        <option value="name">Name</option>
        <option value="price">Price</option>
        <option value="status">Status</option>
      </select>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto p-4 space-y-2">
    {#if filteredItems().length === 0}
      <p class="text-slate-500 text-sm text-center py-8">
        {items.length === 0 ? 'No items yet. Add your first item!' : 'No items match filter.'}
      </p>
    {:else}
      {#each filteredItems() as item (item.id)}
        <ItemCard
          {item}
          isSelected={selectedItemId === item.id}
          onSelect={() => onItemSelect(item.id)}
          onEdit={() => onItemEdit(item.id)}
          onDelete={() => onItemDelete(item.id)}
          onDuplicate={() => onItemDuplicate(item.id)}
        />
      {/each}
    {/if}
  </div>

  <div class="p-4 border-t border-slate-200 bg-slate-50">
    <div class="flex justify-between items-center">
      <span class="text-sm text-slate-600">Total Cost</span>
      <span class="text-lg font-semibold text-slate-800">€{totalCost.toFixed(2)}</span>
    </div>
  </div>
</div>
```

**Step 3: Commit**

```bash
git add src/lib/components/items/
git commit -m "feat: add ItemCard and ItemList components"
```

---

## Task 12: Create Item Form Dialog

**Files:**
- Create: `src/lib/components/items/ItemForm.svelte`

**Step 1: Create ItemForm component**

Create `src/lib/components/items/ItemForm.svelte`:

```svelte
<script lang="ts">
  import type { Item } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Dialog from '$lib/components/ui/dialog';

  interface Props {
    open: boolean;
    item: Partial<Item> | null;
    onSave: (item: Omit<Item, 'id'>) => void;
    onClose: () => void;
  }

  let { open, item, onSave, onClose }: Props = $props();

  let name = $state('');
  let width = $state(100);
  let height = $state(100);
  let color = $state('#D4A574');
  let price = $state<number | null>(null);
  let productUrl = $state('');

  const presetColors = ['#D4A574', '#B8956E', '#8B7355', '#6B8E23', '#4682B4', '#708090', '#CD853F', '#DEB887'];

  // Reset form when item changes
  $effect(() => {
    if (open) {
      name = item?.name ?? '';
      width = item?.width ?? 100;
      height = item?.height ?? 100;
      color = item?.color ?? '#D4A574';
      price = item?.price ?? null;
      productUrl = item?.productUrl ?? '';
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      width,
      height,
      color,
      price,
      productUrl: productUrl.trim() || null,
      position: item?.position ?? null,
      rotation: item?.rotation ?? 0,
    });
    onClose();
  }
</script>

<Dialog.Root {open} onOpenChange={(o) => !o && onClose()}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{item?.name ? 'Edit Item' : 'Add New Item'}</Dialog.Title>
    </Dialog.Header>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div class="space-y-2">
        <Label for="name">Name *</Label>
        <Input id="name" bind:value={name} placeholder="e.g., Sofa, Bed, Desk" required />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label for="width">Width (cm) *</Label>
          <Input id="width" type="number" bind:value={width} min={1} required />
        </div>
        <div class="space-y-2">
          <Label for="height">Depth (cm) *</Label>
          <Input id="height" type="number" bind:value={height} min={1} required />
        </div>
      </div>

      <div class="space-y-2">
        <Label>Color</Label>
        <div class="flex gap-2 flex-wrap">
          {#each presetColors as presetColor}
            <button
              type="button"
              class="w-8 h-8 rounded border-2 transition-all {color === presetColor
                ? 'border-blue-500 scale-110'
                : 'border-transparent'}"
              style="background-color: {presetColor}"
              onclick={() => (color = presetColor)}
            ></button>
          {/each}
          <input
            type="color"
            bind:value={color}
            class="w-8 h-8 rounded cursor-pointer"
          />
        </div>
      </div>

      <div class="space-y-2">
        <Label for="price">Price (€)</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          min={0}
          value={price ?? ''}
          oninput={(e) => {
            const val = e.currentTarget.value;
            price = val ? parseFloat(val) : null;
          }}
          placeholder="Optional"
        />
      </div>

      <div class="space-y-2">
        <Label for="url">Product URL</Label>
        <Input
          id="url"
          type="url"
          bind:value={productUrl}
          placeholder="https://..."
        />
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={onClose}>Cancel</Button>
        <Button type="submit">Save</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
```

**Step 2: Commit**

```bash
git add src/lib/components/items/ItemForm.svelte
git commit -m "feat: add ItemForm dialog for adding/editing items"
```

---

## Task 13: Create Floorplan Upload Component

**Files:**
- Create: `src/lib/components/canvas/FloorplanUpload.svelte`

**Step 1: Create upload component**

Create `src/lib/components/canvas/FloorplanUpload.svelte`:

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  interface Props {
    onUpload: (imageData: string) => void;
  }

  let { onUpload }: Props = $props();
  let isDragging = $state(false);
  let fileInput: HTMLInputElement;

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) processFile(file);
  }

  function handleFileSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) processFile(file);
  }

  function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onUpload(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
</script>

<div
  class="flex flex-col items-center justify-center h-full p-8 text-center
         {isDragging ? 'bg-blue-500/20' : 'bg-canvas-bg'}"
  ondragover={(e) => { e.preventDefault(); isDragging = true; }}
  ondragleave={() => (isDragging = false)}
  ondrop={handleDrop}
  role="button"
  tabindex="0"
>
  <div class="bg-slate-800 rounded-lg p-8 max-w-md">
    <svg class="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
    <h2 class="text-xl font-semibold text-white mb-2">Upload Your Floorplan</h2>
    <p class="text-slate-400 mb-6">
      Drag and drop an image of your floorplan, or click to browse
    </p>
    <input
      bind:this={fileInput}
      type="file"
      accept="image/*"
      class="hidden"
      onchange={handleFileSelect}
    />
    <Button onclick={() => fileInput.click()}>Choose File</Button>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/lib/components/canvas/FloorplanUpload.svelte
git commit -m "feat: add FloorplanUpload component with drag-and-drop"
```

---

## Task 14: Create Scale Calibration Component

**Files:**
- Create: `src/lib/components/canvas/ScaleCalibration.svelte`

**Step 1: Create calibration component**

Create `src/lib/components/canvas/ScaleCalibration.svelte`:

```svelte
<script lang="ts">
  import { Stage, Layer, Image as KonvaImage, Line, Circle, Text } from 'svelte-konva';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  interface Props {
    imageData: string;
    onCalibrate: (scale: number, referenceLength: number) => void;
    onCancel: () => void;
  }

  let { imageData, onCalibrate, onCancel }: Props = $props();

  let containerEl: HTMLDivElement;
  let stageWidth = $state(800);
  let stageHeight = $state(600);
  let image: HTMLImageElement | null = $state(null);

  let point1 = $state<{ x: number; y: number } | null>(null);
  let point2 = $state<{ x: number; y: number } | null>(null);
  let referenceLength = $state(100); // Default 100cm

  // Load image
  $effect(() => {
    const img = new Image();
    img.onload = () => {
      image = img;
    };
    img.src = imageData;
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

  const lineLength = $derived(() => {
    if (!point1 || !point2) return 0;
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
  });

  const scale = $derived(() => {
    const len = lineLength();
    if (len === 0 || referenceLength <= 0) return 0;
    return len / referenceLength; // pixels per cm
  });

  function handleStageClick(e: CustomEvent) {
    const stage = e.detail.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (!point1) {
      point1 = { x: pos.x, y: pos.y };
    } else if (!point2) {
      point2 = { x: pos.x, y: pos.y };
    } else {
      // Reset and start over
      point1 = { x: pos.x, y: pos.y };
      point2 = null;
    }
  }

  function handleConfirm() {
    if (scale() > 0) {
      onCalibrate(scale(), referenceLength);
    }
  }
</script>

<div class="flex flex-col h-full">
  <div class="p-4 bg-blue-600 text-white">
    <h2 class="font-semibold mb-1">Set Scale</h2>
    <p class="text-sm text-blue-100">
      Click two points on your floorplan to draw a reference line, then enter its real-world length.
    </p>
  </div>

  <div bind:this={containerEl} class="flex-1 bg-slate-900">
    <Stage width={stageWidth} height={stageHeight} onclick={handleStageClick}>
      <Layer>
        {#if image}
          <KonvaImage
            image={image}
            x={0}
            y={0}
            width={stageWidth}
            height={stageHeight}
          />
        {/if}

        {#if point1}
          <Circle x={point1.x} y={point1.y} radius={8} fill="#60A5FA" stroke="#fff" strokeWidth={2} />
        {/if}

        {#if point2}
          <Circle x={point2.x} y={point2.y} radius={8} fill="#60A5FA" stroke="#fff" strokeWidth={2} />
        {/if}

        {#if point1 && point2}
          <Line
            points={[point1.x, point1.y, point2.x, point2.y]}
            stroke="#60A5FA"
            strokeWidth={3}
            dash={[10, 5]}
          />
          <Text
            x={(point1.x + point2.x) / 2}
            y={(point1.y + point2.y) / 2 - 20}
            text={`${lineLength().toFixed(0)}px`}
            fill="#fff"
            fontSize={14}
            fontFamily="JetBrains Mono"
          />
        {/if}
      </Layer>
    </Stage>
  </div>

  <div class="p-4 bg-white border-t border-slate-200">
    <div class="flex items-end gap-4">
      <div class="flex-1">
        <Label for="length">Reference Length (cm)</Label>
        <Input
          id="length"
          type="number"
          bind:value={referenceLength}
          min={1}
          class="font-mono"
        />
      </div>
      <div class="text-sm text-slate-600">
        {#if scale() > 0}
          Scale: {scale().toFixed(2)} px/cm
        {:else}
          Draw a reference line
        {/if}
      </div>
      <Button variant="outline" onclick={onCancel}>Cancel</Button>
      <Button onclick={handleConfirm} disabled={scale() === 0}>Confirm Scale</Button>
    </div>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/lib/components/canvas/ScaleCalibration.svelte
git commit -m "feat: add ScaleCalibration component for setting floorplan scale"
```

---

## Task 15: Create Project List Dialog

**Files:**
- Create: `src/lib/components/projects/ProjectListDialog.svelte`

**Step 1: Create component**

Create `src/lib/components/projects/ProjectListDialog.svelte`:

```svelte
<script lang="ts">
  import type { ProjectMeta } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';

  interface Props {
    open: boolean;
    projects: ProjectMeta[];
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
  }

  let { open, projects, onSelect, onDelete, onClose }: Props = $props();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<Dialog.Root {open} onOpenChange={(o) => !o && onClose()}>
  <Dialog.Content class="sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>Open Project</Dialog.Title>
    </Dialog.Header>

    <div class="max-h-96 overflow-y-auto">
      {#if projects.length === 0}
        <p class="text-center text-slate-500 py-8">No saved projects</p>
      {:else}
        <div class="space-y-2">
          {#each projects as project (project.id)}
            <div class="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
              <button
                class="flex-1 text-left"
                onclick={() => { onSelect(project.id); onClose(); }}
              >
                <h3 class="font-medium text-slate-800">{project.name}</h3>
                <p class="text-sm text-slate-500">Updated {formatDate(project.updatedAt)}</p>
              </button>
              <Button
                size="sm"
                variant="ghost"
                class="text-red-600 hover:text-red-700 hover:bg-red-50"
                onclick={() => {
                  if (confirm(`Delete "${project.name}"?`)) {
                    onDelete(project.id);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={onClose}>Cancel</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

**Step 2: Commit**

```bash
git add src/lib/components/projects/ProjectListDialog.svelte
git commit -m "feat: add ProjectListDialog for opening saved projects"
```

---

## Task 16: Integrate All Components in Main Page

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Integrate all components**

Replace `src/routes/+page.svelte` with the full integration:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Item, ProjectMeta, Floorplan } from '$lib/types';
  import {
    getProject,
    setProject,
    createProject,
    updateProjectName,
    setFloorplan,
    addItem,
    updateItem,
    deleteItem,
    duplicateItem,
    getItems,
    getTotalCost,
  } from '$lib/stores/project.svelte';
  import { getAllProjects, getProject as loadProject, deleteProject, saveProject } from '$lib/db';
  import { downloadProject, importProjectFromJSON, readFileAsJSON } from '$lib/utils/export';

  import Header from '$lib/components/layout/Header.svelte';
  import MobileNav from '$lib/components/layout/MobileNav.svelte';
  import FloorplanCanvas from '$lib/components/canvas/FloorplanCanvas.svelte';
  import FloorplanUpload from '$lib/components/canvas/FloorplanUpload.svelte';
  import ScaleCalibration from '$lib/components/canvas/ScaleCalibration.svelte';
  import ItemList from '$lib/components/items/ItemList.svelte';
  import ItemForm from '$lib/components/items/ItemForm.svelte';
  import ProjectListDialog from '$lib/components/projects/ProjectListDialog.svelte';

  // App state
  let activeTab = $state<'plan' | 'items'>('plan');
  let selectedItemId = $state<string | null>(null);
  let showGrid = $state(true);
  let snapToGrid = $state(true);
  let gridSize = $state(50);

  // Dialog state
  let showItemForm = $state(false);
  let editingItem = $state<Partial<Item> | null>(null);
  let showProjectList = $state(false);
  let projectList = $state<ProjectMeta[]>([]);

  // Calibration state
  let pendingImageData = $state<string | null>(null);

  // Reactive project data
  const project = $derived(getProject());
  const items = $derived(getItems());
  const totalCost = $derived(getTotalCost());

  onMount(async () => {
    // Load most recent project or create new one
    const projects = await getAllProjects();
    if (projects.length > 0) {
      const loaded = await loadProject(projects[0].id);
      if (loaded) setProject(loaded);
    } else {
      createProject('My Apartment');
    }
  });

  // Header actions
  async function handleNew() {
    if (confirm('Create a new project? Unsaved changes will be lost.')) {
      createProject('New Project');
    }
  }

  async function handleOpen() {
    projectList = await getAllProjects();
    showProjectList = true;
  }

  async function handleSelectProject(id: string) {
    const loaded = await loadProject(id);
    if (loaded) setProject(loaded);
  }

  async function handleDeleteProject(id: string) {
    await deleteProject(id);
    projectList = await getAllProjects();
    if (project?.id === id) {
      if (projectList.length > 0) {
        const loaded = await loadProject(projectList[0].id);
        if (loaded) setProject(loaded);
      } else {
        createProject('My Apartment');
      }
    }
  }

  function handleExport() {
    if (project) downloadProject(project);
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const json = await readFileAsJSON(file);
        const imported = importProjectFromJSON(json);
        if (imported) {
          setProject(imported);
          await saveProject(imported);
        } else {
          alert('Invalid project file');
        }
      }
    };
    input.click();
  }

  function handleRename() {
    const newName = prompt('Enter project name:', project?.name);
    if (newName) updateProjectName(newName);
  }

  // Floorplan actions
  function handleFloorplanUpload(imageData: string) {
    pendingImageData = imageData;
  }

  function handleCalibrate(scale: number, referenceLength: number) {
    if (pendingImageData) {
      setFloorplan({
        imageData: pendingImageData,
        scale,
        referenceLength,
      });
      pendingImageData = null;
    }
  }

  function handleCancelCalibration() {
    pendingImageData = null;
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

  function handleSaveItem(itemData: Omit<Item, 'id'>) {
    if (editingItem?.id) {
      updateItem(editingItem.id, itemData);
    } else {
      addItem(itemData);
    }
  }

  function handleDeleteItem(id: string) {
    if (confirm('Delete this item?')) {
      deleteItem(id);
      if (selectedItemId === id) selectedItemId = null;
    }
  }

  function handleDuplicateItem(id: string) {
    duplicateItem(id);
  }

  // Canvas actions
  function handleItemSelect(id: string | null) {
    selectedItemId = id;
  }

  function handleItemMove(id: string, x: number, y: number) {
    updateItem(id, { position: { x, y } });
  }

  function handleItemTransform(id: string, width: number, height: number, rotation: number) {
    // Convert pixels back to cm using scale
    const scale = project?.floorplan?.scale ?? 2;
    updateItem(id, {
      width: width / scale,
      height: height / scale,
      rotation,
    });
  }
</script>

{#if project}
  <Header
    projectName={project.name}
    onRename={handleRename}
    onNew={handleNew}
    onOpen={handleOpen}
    onExport={handleExport}
    onImport={handleImport}
  />

  <main class="flex-1 flex flex-col md:flex-row overflow-hidden">
    <!-- Canvas area -->
    <div class="flex-1 {activeTab === 'plan' ? 'flex' : 'hidden'} md:flex flex-col">
      <div class="flex-1 m-2 md:m-4 rounded-lg overflow-hidden">
        {#if pendingImageData}
          <ScaleCalibration
            imageData={pendingImageData}
            onCalibrate={handleCalibrate}
            onCancel={handleCancelCalibration}
          />
        {:else if !project.floorplan}
          <FloorplanUpload onUpload={handleFloorplanUpload} />
        {:else}
          <FloorplanCanvas
            floorplan={project.floorplan}
            {items}
            {selectedItemId}
            {gridSize}
            {showGrid}
            {snapToGrid}
            onItemSelect={handleItemSelect}
            onItemMove={handleItemMove}
            onItemTransform={handleItemTransform}
          />
        {/if}
      </div>

      <!-- Canvas controls -->
      {#if project.floorplan && !pendingImageData}
        <div class="flex items-center gap-4 px-4 pb-4 text-sm">
          <label class="flex items-center gap-2 text-slate-600">
            <input type="checkbox" bind:checked={showGrid} class="rounded" />
            Grid
          </label>
          <label class="flex items-center gap-2 text-slate-600">
            <input type="checkbox" bind:checked={snapToGrid} class="rounded" />
            Snap
          </label>
          <label class="flex items-center gap-2 text-slate-600">
            Grid size:
            <input
              type="number"
              bind:value={gridSize}
              min={10}
              max={100}
              step={10}
              class="w-16 px-2 py-1 rounded border border-slate-200 font-mono text-sm"
            />
            px
          </label>
        </div>
      {/if}
    </div>

    <!-- Item list sidebar -->
    <aside class="w-full md:w-80 {activeTab === 'items' ? 'flex' : 'hidden'} md:flex flex-col bg-white border-l border-slate-200">
      <ItemList
        {items}
        {selectedItemId}
        {totalCost}
        onItemSelect={handleItemSelect}
        onItemEdit={handleEditItem}
        onItemDelete={handleDeleteItem}
        onItemDuplicate={handleDuplicateItem}
        onAddItem={handleAddItem}
      />
    </aside>
  </main>

  <MobileNav {activeTab} onTabChange={(tab) => (activeTab = tab)} />

  <!-- Dialogs -->
  <ItemForm
    open={showItemForm}
    item={editingItem}
    onSave={handleSaveItem}
    onClose={() => (showItemForm = false)}
  />

  <ProjectListDialog
    open={showProjectList}
    projects={projectList}
    onSelect={handleSelectProject}
    onDelete={handleDeleteProject}
    onClose={() => (showProjectList = false)}
  />
{:else}
  <div class="flex-1 flex items-center justify-center">
    <p class="text-slate-500">Loading...</p>
  </div>
{/if}
```

**Step 2: Run and verify full integration**

```bash
bun run dev
```

Expected: Full app working with upload, calibration, item management, and project switching

**Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: integrate all components in main page"
```

---

## Task 17: Add Canvas Controls Component

**Files:**
- Create: `src/lib/components/canvas/CanvasControls.svelte`
- Modify: `src/routes/+page.svelte`

**Step 1: Create CanvasControls component**

Create `src/lib/components/canvas/CanvasControls.svelte`:

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Slider from '$lib/components/ui/slider';

  interface Props {
    zoom: number;
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    onZoomChange: (zoom: number) => void;
    onShowGridChange: (show: boolean) => void;
    onSnapToGridChange: (snap: boolean) => void;
    onGridSizeChange: (size: number) => void;
    onResetFloorplan: () => void;
  }

  let {
    zoom,
    showGrid,
    snapToGrid,
    gridSize,
    onZoomChange,
    onShowGridChange,
    onSnapToGridChange,
    onGridSizeChange,
    onResetFloorplan,
  }: Props = $props();
</script>

<div class="flex items-center gap-4 px-4 py-2 bg-white border-t border-slate-200">
  <div class="flex items-center gap-2">
    <Button size="sm" variant="outline" onclick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}>
      -
    </Button>
    <span class="text-sm text-slate-600 w-16 text-center font-mono">{(zoom * 100).toFixed(0)}%</span>
    <Button size="sm" variant="outline" onclick={() => onZoomChange(Math.min(2, zoom + 0.25))}>
      +
    </Button>
  </div>

  <div class="h-6 w-px bg-slate-200"></div>

  <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
    <input
      type="checkbox"
      checked={showGrid}
      onchange={(e) => onShowGridChange(e.currentTarget.checked)}
      class="rounded"
    />
    Grid
  </label>

  <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
    <input
      type="checkbox"
      checked={snapToGrid}
      onchange={(e) => onSnapToGridChange(e.currentTarget.checked)}
      class="rounded"
    />
    Snap
  </label>

  <div class="h-6 w-px bg-slate-200"></div>

  <label class="flex items-center gap-2 text-sm text-slate-600">
    Grid:
    <input
      type="number"
      value={gridSize}
      min={10}
      max={100}
      step={10}
      onchange={(e) => onGridSizeChange(parseInt(e.currentTarget.value))}
      class="w-14 px-2 py-1 rounded border border-slate-200 font-mono text-sm"
    />
    px
  </label>

  <div class="flex-1"></div>

  <Button size="sm" variant="ghost" onclick={onResetFloorplan}>
    Change Floorplan
  </Button>
</div>
```

**Step 2: Commit**

```bash
git add src/lib/components/canvas/CanvasControls.svelte
git commit -m "feat: add CanvasControls component with zoom and settings"
```

---

## Task 18: Add Overlap Detection

**Files:**
- Create: `src/lib/utils/geometry.ts`
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte`

**Step 1: Create geometry utilities**

Create `src/lib/utils/geometry.ts`:

```typescript
import type { Item, Position } from '$lib/types';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export function itemToRect(item: Item, scale: number): Rect | null {
  if (!item.position) return null;
  return {
    x: item.position.x,
    y: item.position.y,
    width: item.width * scale,
    height: item.height * scale,
    rotation: item.rotation,
  };
}

// Simplified AABB collision (ignoring rotation for simplicity)
export function rectsOverlap(a: Rect, b: Rect): boolean {
  // Get axis-aligned bounds (simplified, ignores rotation)
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;

  return !(aRight <= b.x || a.x >= bRight || aBottom <= b.y || a.y >= bBottom);
}

export function getOverlappingItems(items: Item[], scale: number): Set<string> {
  const overlapping = new Set<string>();
  const rects = items
    .map((item) => ({ item, rect: itemToRect(item, scale) }))
    .filter((r): r is { item: Item; rect: Rect } => r.rect !== null);

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i].rect, rects[j].rect)) {
        overlapping.add(rects[i].item.id);
        overlapping.add(rects[j].item.id);
      }
    }
  }

  return overlapping;
}
```

**Step 2: Update FloorplanCanvas to show overlaps**

In `src/lib/components/canvas/FloorplanCanvas.svelte`, add overlap detection:

Add import:
```typescript
import { getOverlappingItems } from '$lib/utils/geometry';
```

Add derived state:
```typescript
const overlappingIds = $derived(() => {
  const scale = floorplan?.scale ?? 2;
  return getOverlappingItems(items, scale);
});
```

Update Rect fill to show overlap:
```svelte
<Rect
  ...
  fill={overlappingIds().has(item.id) ? '#F87171' : item.color}
  opacity={overlappingIds().has(item.id) ? 0.7 : 1}
  ...
/>
```

**Step 3: Commit**

```bash
git add src/lib/utils/geometry.ts src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: add overlap detection with visual highlighting"
```

---

## Task 19: Final Polish and Testing

**Files:**
- Various fixes and improvements

**Step 1: Test all features manually**

1. Create new project
2. Upload floorplan image
3. Set scale with reference line
4. Add items with all fields
5. Place items on canvas by clicking
6. Drag, resize, rotate items
7. Check overlap detection
8. Export to JSON
9. Import from JSON
10. Switch between projects
11. Test mobile responsive layout

**Step 2: Fix any issues discovered**

(Address bugs found during testing)

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: polish and bug fixes"
```

---

## Summary

**Total Tasks:** 19

**Key Components Built:**
- Project setup with SvelteKit + Bun + TypeScript
- TailwindCSS + shadcn-svelte styling
- IndexedDB persistence layer
- Reactive project store with auto-save
- Floorplan upload and scale calibration
- Konva-based canvas with drag/resize/rotate
- Item management with list and forms
- JSON export/import
- Overlap detection
- Responsive layout for desktop and mobile

**Commands to run full app:**
```bash
bun install
bun run dev
```
