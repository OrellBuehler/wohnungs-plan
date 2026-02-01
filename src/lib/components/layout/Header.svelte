<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Menu } from 'lucide-svelte';
  import LoginButton from '$lib/components/auth/LoginButton.svelte';
  import UserMenu from '$lib/components/auth/UserMenu.svelte';
  import { isAuthenticated } from '$lib/stores/auth.svelte';

  interface Props {
    projectName: string;
    onRename: (newName: string) => void;
    onNew: () => void;
    onOpen: () => void;
    onExport: () => void;
    onImport: () => void;
  }

  let { projectName, onRename, onNew, onOpen, onExport, onImport }: Props = $props();

  const authed = $derived(isAuthenticated());

  let isEditing = $state(false);
  let editValue = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  function startEditing() {
    editValue = projectName;
    isEditing = true;
  }

  function commitEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== projectName) {
      onRename(trimmed);
    }
    isEditing = false;
  }

  function cancelEdit() {
    isEditing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  $effect(() => {
    if (isEditing && inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  });
</script>

<header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
  {#if isEditing}
    <Input
      bind:ref={inputEl}
      bind:value={editValue}
      onblur={commitEdit}
      onkeydown={handleKeydown}
      class="w-auto max-w-64 text-lg font-semibold"
    />
  {:else}
    <Button
      variant="ghost"
      onclick={startEditing}
      class="text-lg font-semibold text-slate-800 hover:text-slate-600"
    >
      {projectName}
    </Button>
  {/if}

  <div class="flex items-center gap-2">
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
        <DropdownMenu.Item onclick={onNew}>New Project</DropdownMenu.Item>
        <DropdownMenu.Item onclick={onOpen}>Open Project</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onclick={onExport}>Export JSON</DropdownMenu.Item>
        <DropdownMenu.Item onclick={onImport}>Import JSON</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</header>
