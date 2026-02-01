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

  let { open = $bindable(), projects, onSelect, onDelete, onClose }: Props = $props();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleClose() {
    open = false;
    onClose();
  }
</script>

<Dialog.Root bind:open onOpenChange={(o) => !o && handleClose()}>
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
              <Button
                variant="ghost"
                class="flex-1 text-left justify-start h-auto py-0"
                onclick={() => { onSelect(project.id); handleClose(); }}
              >
                <div class="flex flex-col items-start">
                  <h3 class="font-medium text-slate-800">{project.name}</h3>
                  <p class="text-sm text-slate-500">Updated {formatDate(project.updatedAt)}</p>
                </div>
              </Button>
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
      <Button variant="outline" onclick={handleClose}>Cancel</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
