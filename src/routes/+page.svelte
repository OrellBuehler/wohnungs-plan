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
