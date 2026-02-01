<script lang="ts">
  import type { Item } from '$lib/types';
  import type { CurrencyCode } from '$lib/utils/currency';
  import { getCurrencySymbol } from '$lib/utils/currency';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Dialog from '$lib/components/ui/dialog';

  interface Props {
    open: boolean;
    item: Partial<Item> | null;
    currency: CurrencyCode;
    onSave: (item: Omit<Item, 'id'>) => void;
    onClose: () => void;
  }

  let { open = $bindable(), item, currency, onSave, onClose }: Props = $props();

  const currencySymbol = $derived(getCurrencySymbol(currency));

  let name = $state('');
  let width = $state(100);
  let height = $state(100);
  let color = $state('#D4A574');
  let price = $state<number | string>('');
  let productUrl = $state('');

  const presetColors = ['#D4A574', '#B8956E', '#8B7355', '#6B8E23', '#4682B4', '#708090', '#CD853F', '#DEB887'];

  // Reset form when item changes
  $effect(() => {
    if (open) {
      name = item?.name ?? '';
      width = item?.width ?? 100;
      height = item?.height ?? 100;
      color = item?.color ?? '#D4A574';
      price = item?.price !== null && item?.price !== undefined ? item.price.toString() : '';
      productUrl = item?.productUrl ?? '';
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const nameValue = String(name).trim();
    if (!nameValue) return;

    // Handle price being number or string
    const priceValue = typeof price === 'number' ? price : (String(price).trim() ? parseFloat(String(price)) : null);
    const urlValue = String(productUrl).trim() || null;

    onSave({
      name: nameValue,
      width: Number(width),
      height: Number(height),
      color: String(color),
      price: priceValue,
      productUrl: urlValue,
      position: item?.position ?? null,
      rotation: item?.rotation ?? 0,
    });
    onClose();
  }

  function handleClose() {
    open = false;
    onClose();
  }
</script>

<Dialog.Root bind:open onOpenChange={(o) => !o && handleClose()}>
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="w-8 h-8 rounded border-2 p-0 transition-all {color === presetColor
                ? 'border-blue-500 scale-110'
                : 'border-transparent'}"
              style="background-color: {presetColor}"
              onclick={() => (color = presetColor)}
              aria-label="Select color {presetColor}"
            ></Button>
          {/each}
          <input
            type="color"
            bind:value={color}
            class="w-8 h-8 rounded cursor-pointer"
          />
        </div>
      </div>

      <div class="space-y-2">
        <Label for="price">Price ({currencySymbol})</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          min={0}
          bind:value={price}
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
        <Button type="button" variant="outline" onclick={handleClose}>Cancel</Button>
        <Button type="submit">Save</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
