# Projects Overview Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a projects overview page at `/` showing all projects with thumbnails, storage status, and sharing controls; move the editor to `/projects/[id]`.

**Architecture:** The homepage becomes a grid of project cards. Each card shows a floorplan thumbnail, name, cloud/local indicator, and shared status. The existing editor page moves to a dynamic route. The project store gets extended with a function to fetch enriched project lists (with member counts and floorplan info).

**Tech Stack:** SvelteKit, Svelte 5, shadcn-svelte, TailwindCSS, Drizzle ORM

---

## Task 1: Extend ProjectMeta Type

**Files:**
- Modify: `src/lib/types/index.ts:46-51`

**Step 1: Add new fields to ProjectMeta**

```typescript
export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // New fields for overview page
  isLocal: boolean;              // true if only in IndexedDB
  floorplanUrl: string | null;   // thumbnail URL or null
  memberCount: number;           // 0 for local, 1+ for shared cloud projects
}
```

**Step 2: Commit**

```bash
git add src/lib/types/index.ts
git commit -m "feat: extend ProjectMeta with isLocal, floorplanUrl, memberCount"
```

---

## Task 2: Update API to Return Enriched Project List

**Files:**
- Modify: `src/lib/server/projects.ts`
- Modify: `src/routes/api/projects/+server.ts`

**Step 1: Add function to get enriched projects in server/projects.ts**

Add this function after the existing `getUserProjects`:

```typescript
export async function getUserProjectsWithDetails(userId: string) {
  const userProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      floorplanFilename: floorplans.filename,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM project_members
        WHERE project_members.project_id = ${projects.id}
      )`.as('member_count')
    })
    .from(projects)
    .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .leftJoin(floorplans, eq(floorplans.projectId, projects.id))
    .where(
      or(
        eq(projects.ownerId, userId),
        eq(projectMembers.userId, userId)
      )
    )
    .groupBy(projects.id, floorplans.filename)
    .orderBy(desc(projects.updatedAt));

  return userProjects.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: p.updatedAt?.toISOString() ?? new Date().toISOString(),
    isLocal: false,
    floorplanUrl: p.floorplanFilename ? `/api/images/floorplans/${p.id}/${p.floorplanFilename}` : null,
    memberCount: Number(p.memberCount) || 1
  }));
}
```

**Step 2: Update the GET endpoint to use new function**

In `src/routes/api/projects/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserProjectsWithDetails, createProject } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Authentication required');
  }

  const projects = await getUserProjectsWithDetails(locals.user.id);
  return json({ projects });
};
```

**Step 3: Commit**

```bash
git add src/lib/server/projects.ts src/routes/api/projects/+server.ts
git commit -m "feat: API returns enriched project list with floorplan URLs and member counts"
```

---

## Task 3: Update Project Store for Overview Page

**Files:**
- Modify: `src/lib/stores/project.svelte.ts`

**Step 1: Update listProjects to return enriched ProjectMeta**

Replace the existing `listProjects` function:

```typescript
export async function listProjects(): Promise<ProjectMeta[]> {
  const localProjects = await getLocalProjects();
  const localMetas: ProjectMeta[] = localProjects.map((p) => ({
    ...p,
    isLocal: true,
    floorplanUrl: null, // Will be loaded separately for local
    memberCount: 0
  }));

  if (!isAuthenticated()) {
    return localMetas;
  }

  try {
    const response = await fetch('/api/projects');
    if (!response.ok) throw new Error('Failed to load projects');
    const data = await response.json();
    const cloudMetas: ProjectMeta[] = data.projects;

    // Merge: cloud projects override local ones with same ID
    const cloudIds = new Set(cloudMetas.map((p: ProjectMeta) => p.id));
    const localOnly = localMetas.filter((p) => !cloudIds.has(p.id));

    return [...cloudMetas, ...localOnly].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    console.error('Failed to load remote projects:', error);
    return localMetas;
  }
}
```

**Step 2: Add function to get local floorplan as data URL**

```typescript
export async function getLocalFloorplanUrl(projectId: string): Promise<string | null> {
  const project = await loadLocalProject(projectId);
  return project?.floorplan?.imageData ?? null;
}
```

**Step 3: Add syncProjectToCloud function**

```typescript
export async function syncProjectToCloud(projectId: string): Promise<boolean> {
  if (!isAuthenticated()) return false;

  const project = await loadLocalProject(projectId);
  if (!project) return false;

  try {
    // Create project in cloud
    const createRes = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: project.id,
        name: project.name,
        currency: project.currency,
        gridSize: project.gridSize
      })
    });
    if (!createRes.ok) throw new Error('Failed to create project');

    // Upload floorplan if exists
    if (project.floorplan) {
      await uploadFloorplan(project.id, project.floorplan);
    }

    // Create all items
    for (const item of project.items) {
      await fetch(`/api/projects/${project.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildItemPayload(item))
      });
    }

    // Remove from local storage
    await deleteLocalProject(projectId);
    return true;
  } catch (error) {
    console.error('Failed to sync project:', error);
    return false;
  }
}
```

**Step 4: Commit**

```bash
git add src/lib/stores/project.svelte.ts
git commit -m "feat: project store supports enriched listing and cloud sync"
```

---

## Task 4: Create ProjectCard Component

**Files:**
- Create: `src/lib/components/projects/ProjectCard.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import type { ProjectMeta } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Cloud, HardDrive, Users, MoreVertical, Trash2, Share2, Upload } from 'lucide-svelte';
  import { isAuthenticated } from '$lib/stores/auth.svelte';
  import { getLocalFloorplanUrl } from '$lib/stores/project.svelte';
  import { onMount } from 'svelte';

  interface Props {
    project: ProjectMeta;
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
    onShare: (id: string) => void;
    onSync: (id: string) => void;
  }

  let { project, onOpen, onDelete, onShare, onSync }: Props = $props();

  const authed = $derived(isAuthenticated());
  let localThumbnail = $state<string | null>(null);

  onMount(async () => {
    if (project.isLocal && !project.floorplanUrl) {
      localThumbnail = await getLocalFloorplanUrl(project.id);
    }
  });

  const thumbnailUrl = $derived(project.floorplanUrl ?? localThumbnail);

  function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }
</script>

<div class="group relative flex flex-col rounded-lg border border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all">
  <button
    type="button"
    onclick={() => onOpen(project.id)}
    class="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden"
  >
    {#if thumbnailUrl}
      <img
        src={thumbnailUrl}
        alt={project.name}
        class="w-full h-full object-cover"
      />
    {:else}
      <div class="text-slate-300">
        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </div>
    {/if}
  </button>

  <div class="p-3 flex flex-col gap-1">
    <button
      type="button"
      onclick={() => onOpen(project.id)}
      class="text-left font-medium text-slate-800 truncate hover:text-slate-600"
    >
      {project.name}
    </button>

    <div class="flex items-center justify-between text-sm text-slate-500">
      <div class="flex items-center gap-2">
        {#if project.isLocal}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <HardDrive size={14} class="text-amber-500" />
            </Tooltip.Trigger>
            <Tooltip.Content>Stored locally in browser</Tooltip.Content>
          </Tooltip.Root>
        {:else}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <Cloud size={14} class="text-blue-500" />
            </Tooltip.Trigger>
            <Tooltip.Content>Synced to cloud</Tooltip.Content>
          </Tooltip.Root>
        {/if}
        <span>{formatRelativeTime(project.updatedAt)}</span>
      </div>

      <div class="flex items-center gap-1">
        {#if !project.isLocal && project.memberCount > 1}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <div class="flex items-center gap-0.5 text-slate-400">
                <Users size={14} />
                <span class="text-xs">{project.memberCount}</span>
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content>Shared with {project.memberCount - 1} other{project.memberCount > 2 ? 's' : ''}</Tooltip.Content>
          </Tooltip.Root>
        {/if}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="ghost" size="sm" class="h-7 w-7 p-0">
                <MoreVertical size={14} />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onclick={() => onOpen(project.id)}>
              Open
            </DropdownMenu.Item>

            {#if project.isLocal}
              <Tooltip.Root>
                <Tooltip.Trigger class="w-full">
                  <DropdownMenu.Item disabled class="opacity-50">
                    <Share2 size={14} class="mr-2" />
                    Share
                  </DropdownMenu.Item>
                </Tooltip.Trigger>
                <Tooltip.Content>Sync to cloud to share</Tooltip.Content>
              </Tooltip.Root>

              {#if authed}
                <DropdownMenu.Item onclick={() => onSync(project.id)}>
                  <Upload size={14} class="mr-2" />
                  Sync to cloud
                </DropdownMenu.Item>
              {/if}
            {:else}
              <DropdownMenu.Item onclick={() => onShare(project.id)}>
                <Share2 size={14} class="mr-2" />
                Share
              </DropdownMenu.Item>
            {/if}

            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onclick={() => onDelete(project.id)}
              class="text-red-600 focus:text-red-600"
            >
              <Trash2 size={14} class="mr-2" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </div>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/lib/components/projects/ProjectCard.svelte
git commit -m "feat: add ProjectCard component with thumbnail and actions"
```

---

## Task 5: Create Projects Overview Page

**Files:**
- Rewrite: `src/routes/+page.svelte`

**Step 1: Create the new overview page**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { ProjectMeta } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Plus } from 'lucide-svelte';
  import Header from '$lib/components/layout/Header.svelte';
  import ProjectCard from '$lib/components/projects/ProjectCard.svelte';
  import ShareDialog from '$lib/components/sharing/ShareDialog.svelte';
  import { listProjects, createProject, removeProject, syncProjectToCloud } from '$lib/stores/project.svelte';
  import { isAuthenticated } from '$lib/stores/auth.svelte';

  let projects = $state<ProjectMeta[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Share dialog state
  let shareDialogOpen = $state(false);
  let shareProjectId = $state<string | null>(null);

  // Delete dialog state
  let deleteDialogOpen = $state(false);
  let deleteProject = $state<ProjectMeta | null>(null);

  const authed = $derived(isAuthenticated());

  onMount(() => {
    loadProjects();
  });

  async function loadProjects() {
    isLoading = true;
    error = null;
    try {
      projects = await listProjects();
    } catch (e) {
      error = 'Failed to load projects';
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  async function handleNew() {
    const project = createProject('Untitled Project');
    await goto(`/projects/${project.id}`);
  }

  function handleOpen(id: string) {
    goto(`/projects/${id}`);
  }

  function handleShare(id: string) {
    shareProjectId = id;
    shareDialogOpen = true;
  }

  function handleDeleteClick(id: string) {
    deleteProject = projects.find((p) => p.id === id) ?? null;
    deleteDialogOpen = true;
  }

  async function confirmDelete() {
    if (!deleteProject) return;
    await removeProject(deleteProject.id);
    projects = projects.filter((p) => p.id !== deleteProject!.id);
    deleteDialogOpen = false;
    deleteProject = null;
  }

  async function handleSync(id: string) {
    const success = await syncProjectToCloud(id);
    if (success) {
      await loadProjects();
    }
  }
</script>

<div class="min-h-screen bg-slate-50 flex flex-col">
  <header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
    <h1 class="text-lg font-semibold text-slate-800">Wohnungs-Plan</h1>
    <div class="flex items-center gap-2">
      {#if authed}
        {@const UserMenu = (await import('$lib/components/auth/UserMenu.svelte')).default}
        <UserMenu />
      {:else}
        {@const LoginButton = (await import('$lib/components/auth/LoginButton.svelte')).default}
        <LoginButton />
      {/if}
    </div>
  </header>

  <main class="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-slate-900">My Projects</h2>
      <Button onclick={handleNew}>
        <Plus size={16} class="mr-1" />
        New Project
      </Button>
    </div>

    {#if isLoading}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {#each Array(6) as _}
          <div class="aspect-video bg-slate-200 rounded-lg animate-pulse"></div>
        {/each}
      </div>
    {:else if error}
      <div class="text-center py-12">
        <p class="text-red-600 mb-4">{error}</p>
        <Button variant="outline" onclick={loadProjects}>Retry</Button>
      </div>
    {:else if projects.length === 0}
      <div class="text-center py-16">
        <div class="text-slate-300 mb-4">
          <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-slate-700 mb-2">No projects yet</h3>
        <p class="text-slate-500 mb-6">Create your first project to get started</p>
        <Button onclick={handleNew}>
          <Plus size={16} class="mr-1" />
          Create your first project
        </Button>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {#each projects as project (project.id)}
          <ProjectCard
            {project}
            onOpen={handleOpen}
            onDelete={handleDeleteClick}
            onShare={handleShare}
            onSync={handleSync}
          />
        {/each}
      </div>
    {/if}

    {#if !authed && projects.length > 0}
      <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
        <p class="text-blue-800">
          Sign in to sync and share your projects across devices
        </p>
      </div>
    {/if}
  </main>
</div>

{#if shareProjectId}
  <ShareDialog
    bind:open={shareDialogOpen}
    projectId={shareProjectId}
    onClose={() => (shareProjectId = null)}
  />
{/if}

<Dialog.Root bind:open={deleteDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Delete "{deleteProject?.name}"?</Dialog.Title>
      <Dialog.Description>
        This cannot be undone. All items and floorplans will be permanently deleted.
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (deleteDialogOpen = false)}>Cancel</Button>
      <Button variant="destructive" onclick={confirmDelete}>Delete</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

**Step 2: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: replace homepage with projects overview grid"
```

---

## Task 6: Move Editor to /projects/[id]

**Files:**
- Create: `src/routes/projects/[id]/+page.svelte`

**Step 1: Create directory and move editor code**

Copy the original `+page.svelte` content (the editor) to the new location with modifications for back navigation:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import type { Item, ProjectMeta } from '$lib/types';
  import type { CurrencyCode } from '$lib/utils/currency';
  import {
    getProject,
    setProject,
    createProject,
    updateProjectName,
    setFloorplan,
    clearFloorplan,
    addItem,
    updateItem,
    deleteItem,
    duplicateItem,
    getItems,
    getCurrency,
    setCurrency,
    getGridSize,
    setGridSize,
    loadProjectById,
  } from '$lib/stores/project.svelte';
  import { saveProject } from '$lib/db';
  import { downloadProject, importProjectFromJSON, readFileAsJSON } from '$lib/utils/export';
  import { fetchExchangeRates, convertCurrency, type ExchangeRates } from '$lib/utils/exchange';

  import MobileNav from '$lib/components/layout/MobileNav.svelte';
  import FloorplanCanvas from '$lib/components/canvas/FloorplanCanvas.svelte';
  import FloorplanUpload from '$lib/components/canvas/FloorplanUpload.svelte';
  import ScaleCalibration from '$lib/components/canvas/ScaleCalibration.svelte';
  import CanvasControls from '$lib/components/canvas/CanvasControls.svelte';
  import ItemList from '$lib/components/items/ItemList.svelte';
  import ItemForm from '$lib/components/items/ItemForm.svelte';
  import ShareDialog from '$lib/components/sharing/ShareDialog.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Menu, ArrowLeft, Share2 } from 'lucide-svelte';
  import LoginButton from '$lib/components/auth/LoginButton.svelte';
  import UserMenu from '$lib/components/auth/UserMenu.svelte';
  import { isAuthenticated } from '$lib/stores/auth.svelte';

  // Get project ID from route
  const projectId = $derived($page.params.id);
  const authed = $derived(isAuthenticated());

  // App state
  let activeTab = $state<'plan' | 'items'>('plan');
  let selectedItemId = $state<string | null>(null);
  let showGrid = $state(true);
  let snapToGrid = $state(true);
  let canvasViewportCenter = $state({ x: 200, y: 200 });

  // Dialog state
  let showItemForm = $state(false);
  let editingItem = $state<Partial<Item> | null>(null);
  let showShareDialog = $state(false);

  // Calibration state
  let pendingImageData = $state<string | null>(null);

  // Exchange rate state
  let exchangeRates = $state<ExchangeRates | null>(null);
  let isLoadingRates = $state(false);

  // Header editing state
  let isEditingName = $state(false);
  let editNameValue = $state('');
  let nameInputEl = $state<HTMLInputElement | null>(null);

  // Reactive project data
  const project = $derived(getProject());
  const items = $derived(getItems());
  const displayCurrency = $derived(getCurrency());
  const gridSize = $derived(getGridSize());

  function handleGridSizeChange(newSize: number) {
    setGridSize(newSize);
  }

  // Calculate total cost with currency conversion
  const totalCost = $derived.by(() => {
    const rates = exchangeRates;
    if (!rates) {
      return items.reduce((sum, item) => sum + (item.price ?? 0), 0);
    }

    return items.reduce((sum, item) => {
      if (item.price === null) return sum;
      const converted = convertCurrency(
        item.price,
        item.priceCurrency,
        displayCurrency,
        rates
      );
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
    const loaded = await loadProjectById(projectId);
    if (loaded) {
      setProject(loaded);
    } else {
      // Project not found, redirect to overview
      goto('/');
    }
  });

  // Header name editing
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
          goto(`/projects/${imported.id}`);
        } else {
          alert('Invalid project file');
        }
      }
    };
    input.click();
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

  function handleChangeFloorplan() {
    if (confirm('Change floorplan? Item positions will be kept.')) {
      clearFloorplan();
    }
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

  function handlePlaceItem(id: string) {
    updateItem(id, { position: { x: canvasViewportCenter.x, y: canvasViewportCenter.y } });
    activeTab = 'plan';
  }

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
</script>

{#if project}
  <header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
    <div class="flex items-center gap-2">
      <Button variant="ghost" size="sm" onclick={() => goto('/')}>
        <ArrowLeft size={16} class="mr-1" />
        Projects
      </Button>

      <span class="text-slate-300">|</span>

      {#if isEditingName}
        <Input
          bind:ref={nameInputEl}
          bind:value={editNameValue}
          onblur={commitNameEdit}
          onkeydown={handleNameKeydown}
          class="w-auto max-w-64 text-lg font-semibold"
        />
      {:else}
        <Button
          variant="ghost"
          onclick={startEditingName}
          class="text-lg font-semibold text-slate-800 hover:text-slate-600"
        >
          {project.name}
        </Button>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      {#if !project.isLocal}
        <Button variant="outline" size="sm" onclick={() => (showShareDialog = true)}>
          <Share2 size={16} class="mr-1" />
          Share
        </Button>
      {/if}

      {#if authed}
        <UserMenu />
      {:else}
        <LoginButton />
      {/if}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline" size="sm">
              <Menu size={16} class="mr-1" /> Menu
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onclick={handleExport}>Export JSON</DropdownMenu.Item>
          <DropdownMenu.Item onclick={handleImport}>Import JSON</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </header>

  <main class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
    <div class="flex-1 min-h-0 {activeTab === 'plan' ? 'flex' : 'hidden'} md:flex flex-col">
      <div class="flex-1 min-h-0 m-2 md:m-4 rounded-lg overflow-hidden">
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
            bind:viewportCenter={canvasViewportCenter}
            onItemSelect={handleItemSelect}
            onItemMove={handleItemMove}
            onItemRotate={handleItemRotate}
          />
        {/if}
      </div>

      {#if project.floorplan && !pendingImageData}
        <CanvasControls
          bind:showGrid
          bind:snapToGrid
          {gridSize}
          onChangeFloorplan={handleChangeFloorplan}
          onGridSizeChange={handleGridSizeChange}
        />
      {/if}
    </div>

    <aside class="w-full md:w-80 min-h-0 {activeTab === 'items' ? 'flex' : 'hidden'} md:flex flex-col bg-white border-l border-slate-200">
      <ItemList
        {items}
        {selectedItemId}
        {totalCost}
        {displayCurrency}
        {isLoadingRates}
        onItemSelect={handleItemSelect}
        onItemEdit={handleEditItem}
        onItemDelete={handleDeleteItem}
        onItemDuplicate={handleDuplicateItem}
        onItemPlace={handlePlaceItem}
        onAddItem={handleAddItem}
        onDisplayCurrencyChange={handleDisplayCurrencyChange}
      />
    </aside>
  </main>

  <MobileNav {activeTab} onTabChange={(tab) => (activeTab = tab)} />

  <ItemForm
    bind:open={showItemForm}
    item={editingItem}
    defaultCurrency={displayCurrency}
    onSave={handleSaveItem}
    onClose={() => (showItemForm = false)}
  />

  <ShareDialog
    bind:open={showShareDialog}
    projectId={project.id}
    onClose={() => (showShareDialog = false)}
  />
{:else}
  <div class="flex-1 flex items-center justify-center">
    <p class="text-slate-500">Loading...</p>
  </div>
{/if}
```

**Step 2: Commit**

```bash
mkdir -p src/routes/projects/\[id\]
git add src/routes/projects/\[id\]/+page.svelte
git commit -m "feat: move editor to /projects/[id] route with back navigation"
```

---

## Task 7: Add isLocal Flag to Project Type and Store

**Files:**
- Modify: `src/lib/types/index.ts`
- Modify: `src/lib/stores/project.svelte.ts`

**Step 1: Add isLocal to Project interface**

In `src/lib/types/index.ts`, update the Project interface:

```typescript
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  floorplan: Floorplan | null;
  items: Item[];
  currency: CurrencyCode;
  gridSize: number;
  isLocal?: boolean;  // true if stored only in IndexedDB
}
```

**Step 2: Update loadProjectById to set isLocal**

In `src/lib/stores/project.svelte.ts`, modify `loadProjectById`:

```typescript
export async function loadProjectById(id: string): Promise<Project | null> {
  if (!useRemote()) {
    const local = await loadLocalProject(id);
    if (local) {
      return { ...local, isLocal: true };
    }
    return null;
  }

  try {
    const response = await fetch(`/api/projects/${id}`);
    if (!response.ok) throw new Error('Failed to load project');
    const data = await response.json();
    const project = mapApiProject(data.project, data.items ?? [], data.floorplan ?? null);
    project.isLocal = false;
    await saveLocalProject(project);
    return project;
  } catch (error) {
    console.error('Failed to load remote project:', error);
    const local = await loadLocalProject(id);
    if (local) {
      return { ...local, isLocal: true };
    }
    return null;
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/types/index.ts src/lib/stores/project.svelte.ts
git commit -m "feat: track isLocal flag on projects for conditional sharing UI"
```

---

## Task 8: Update Server Projects Query

**Files:**
- Modify: `src/lib/server/projects.ts`

**Step 1: Read current file and add imports**

Add necessary imports at the top:

```typescript
import { eq, or, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { projects, projectMembers, floorplans } from './schema';
```

**Step 2: Implement getUserProjectsWithDetails**

Add after existing functions:

```typescript
export async function getUserProjectsWithDetails(userId: string) {
  const results = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      floorplanFilename: floorplans.filename
    })
    .from(projects)
    .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .leftJoin(floorplans, eq(floorplans.projectId, projects.id))
    .where(
      or(
        eq(projects.ownerId, userId),
        eq(projectMembers.userId, userId)
      )
    )
    .groupBy(projects.id, floorplans.filename)
    .orderBy(desc(projects.updatedAt));

  // Get member counts separately to avoid complex subquery issues
  const memberCounts = await db
    .select({
      projectId: projectMembers.projectId,
      count: sql<number>`count(*)`.as('count')
    })
    .from(projectMembers)
    .groupBy(projectMembers.projectId);

  const countMap = new Map(memberCounts.map((m) => [m.projectId, Number(m.count)]));

  return results.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: p.updatedAt?.toISOString() ?? new Date().toISOString(),
    isLocal: false,
    floorplanUrl: p.floorplanFilename
      ? `/api/images/floorplans/${p.id}/${p.floorplanFilename}`
      : null,
    memberCount: countMap.get(p.id) ?? 1
  }));
}
```

**Step 3: Commit**

```bash
git add src/lib/server/projects.ts
git commit -m "feat: add getUserProjectsWithDetails for enriched project listing"
```

---

## Task 9: Final Integration and Testing

**Step 1: Run type check**

```bash
bun check
```

Expected: No type errors

**Step 2: Run dev server and test**

```bash
bun dev
```

Test manually:
1. Visit `/` - should see projects grid
2. Click "New Project" - should create and navigate to `/projects/[id]`
3. Click back arrow - should return to `/`
4. Click project card - should open editor
5. Test overflow menu actions

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: projects overview page complete"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Extend ProjectMeta type with isLocal, floorplanUrl, memberCount |
| 2 | Update API to return enriched project list |
| 3 | Update project store for overview page |
| 4 | Create ProjectCard component |
| 5 | Create projects overview page at `/` |
| 6 | Move editor to `/projects/[id]` |
| 7 | Add isLocal flag to Project type |
| 8 | Implement server-side getUserProjectsWithDetails |
| 9 | Integration testing |
