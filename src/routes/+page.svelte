<script lang="ts">
  import { onMount } from 'svelte';
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
  } from '$lib/stores/project.svelte';
  import { getAllProjects, getProject as loadProject, deleteProject, saveProject } from '$lib/db';
  import { downloadProject, importProjectFromJSON, readFileAsJSON } from '$lib/utils/export';
  import { fetchExchangeRates, convertCurrency, type ExchangeRates } from '$lib/utils/exchange';

  import Header from '$lib/components/layout/Header.svelte';
  import MobileNav from '$lib/components/layout/MobileNav.svelte';
  import FloorplanCanvas from '$lib/components/canvas/FloorplanCanvas.svelte';
  import FloorplanUpload from '$lib/components/canvas/FloorplanUpload.svelte';
  import ScaleCalibration from '$lib/components/canvas/ScaleCalibration.svelte';
  import CanvasControls from '$lib/components/canvas/CanvasControls.svelte';
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

  // Exchange rate state
  let exchangeRates = $state<ExchangeRates | null>(null);
  let isLoadingRates = $state(false);

  // Reactive project data
  const project = $derived(getProject());
  const items = $derived(getItems());
  const displayCurrency = $derived(getCurrency());

  // Calculate total cost with currency conversion
  const totalCost = $derived.by(() => {
    if (!exchangeRates) {
      // No rates yet, just sum raw prices
      return items.reduce((sum, item) => sum + (item.price ?? 0), 0);
    }

    return items.reduce((sum, item) => {
      if (item.price === null) return sum;
      const converted = convertCurrency(
        item.price,
        item.priceCurrency,
        displayCurrency,
        exchangeRates
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
    updateItem(id, { position: { x: 100, y: 100 } });
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
  <Header
    projectName={project.name}
    onRename={handleRename}
    onNew={handleNew}
    onOpen={handleOpen}
    onExport={handleExport}
    onImport={handleImport}
  />

  <main class="flex-1 flex flex-col md:flex-row overflow-hidden">
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
            onItemRotate={handleItemRotate}
          />
        {/if}
      </div>

      {#if project.floorplan && !pendingImageData}
        <CanvasControls
          bind:showGrid
          bind:snapToGrid
          bind:gridSize
          onChangeFloorplan={handleChangeFloorplan}
        />
      {/if}
    </div>

    <aside class="w-full md:w-80 {activeTab === 'items' ? 'flex' : 'hidden'} md:flex flex-col bg-white border-l border-slate-200">
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

  <ProjectListDialog
    bind:open={showProjectList}
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
