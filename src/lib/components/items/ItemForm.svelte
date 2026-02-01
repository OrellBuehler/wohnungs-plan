<script lang="ts">
  import type { Item, ItemShape, CutoutCorner } from '$lib/types';
  import type { CurrencyCode } from '$lib/utils/currency';
  import { CURRENCIES, DEFAULT_CURRENCY } from '$lib/utils/currency';
  import { getLShapePoints, getRectPoints } from '$lib/utils/geometry';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';

  interface Props {
    open: boolean;
    item: Partial<Item> | null;
    defaultCurrency: CurrencyCode;
    onSave: (item: Omit<Item, 'id'>) => void;
    onClose: () => void;
  }

  let { open = $bindable(), item, defaultCurrency, onSave, onClose }: Props = $props();

  let name = $state('');
  let width = $state(100);
  let height = $state(100);
  let color = $state('#D4A574');
  let price = $state<number | string>('');
  let priceCurrency = $state<CurrencyCode>(DEFAULT_CURRENCY);
  let productUrl = $state('');
  let shape = $state<ItemShape>('rectangle');
  let cutoutWidth = $state(50);
  let cutoutHeight = $state(50);
  let cutoutCorner = $state<CutoutCorner>('bottom-right');

  const presetColors = [
    '#E8D4B8', // Light wood / cream
    '#8B5A2B', // Dark wood / walnut
    '#64748B', // Slate gray
    '#3B82F6', // Blue
    '#22C55E', // Green
    '#EF4444', // Red
    '#A855F7', // Purple
    '#F59E0B', // Amber / yellow
    '#14B8A6', // Teal
    '#1F2937', // Charcoal / black
  ];

  const cutoutCornerOptions: { value: CutoutCorner; label: string }[] = [
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'bottom-right', label: 'Bottom Right' },
  ];

  // Reset form when item changes
  $effect(() => {
    if (open) {
      name = item?.name ?? '';
      width = item?.width ?? 100;
      height = item?.height ?? 100;
      color = item?.color ?? '#D4A574';
      price = item?.price !== null && item?.price !== undefined ? item.price.toString() : '';
      priceCurrency = item?.priceCurrency ?? defaultCurrency;
      productUrl = item?.productUrl ?? '';
      shape = item?.shape ?? 'rectangle';
      cutoutWidth = item?.cutoutWidth ?? 50;
      cutoutHeight = item?.cutoutHeight ?? 50;
      cutoutCorner = item?.cutoutCorner ?? 'bottom-right';
    }
  });

  // Generate SVG path for shape preview
  const previewPath = $derived.by(() => {
    const previewW = 60;
    const previewH = 40;
    const scaleX = previewW / Math.max(width, 1);
    const scaleY = previewH / Math.max(height, 1);
    const scale = Math.min(scaleX, scaleY);

    const w = width * scale;
    const h = height * scale;

    let points: number[];
    if (shape === 'l-shape') {
      const cw = cutoutWidth * scale;
      const ch = cutoutHeight * scale;
      points = getLShapePoints(w, h, cw, ch, cutoutCorner);
    } else {
      points = getRectPoints(w, h);
    }

    // Convert to SVG path
    const pathParts: string[] = [];
    for (let i = 0; i < points.length; i += 2) {
      const cmd = i === 0 ? 'M' : 'L';
      pathParts.push(`${cmd}${points[i]},${points[i + 1]}`);
    }
    pathParts.push('Z');
    return pathParts.join(' ');
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const nameValue = String(name).trim();
    if (!nameValue) return;

    // Handle price being number or string
    const priceValue = typeof price === 'number' ? price : (String(price).trim() ? parseFloat(String(price)) : null);
    const urlValue = String(productUrl).trim() || null;

    const itemData: Omit<Item, 'id'> = {
      name: nameValue,
      width: Number(width),
      height: Number(height),
      color: String(color),
      price: priceValue,
      priceCurrency,
      productUrl: urlValue,
      position: item?.position ?? null,
      rotation: item?.rotation ?? 0,
      shape,
    };

    // Add L-shape specific fields
    if (shape === 'l-shape') {
      itemData.cutoutWidth = Number(cutoutWidth);
      itemData.cutoutHeight = Number(cutoutHeight);
      itemData.cutoutCorner = cutoutCorner;
    }

    onSave(itemData);
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

      <!-- Shape selector with preview -->
      <div class="space-y-2">
        <Label>Shape</Label>
        <div class="flex items-center gap-4">
          <div class="flex gap-2">
            <Button
              type="button"
              variant={shape === 'rectangle' ? 'default' : 'outline'}
              size="sm"
              onclick={() => (shape = 'rectangle')}
            >
              Rectangle
            </Button>
            <Button
              type="button"
              variant={shape === 'l-shape' ? 'default' : 'outline'}
              size="sm"
              onclick={() => (shape = 'l-shape')}
            >
              L-Shape
            </Button>
          </div>
          <svg width="60" height="40" class="border rounded bg-slate-50">
            <path d={previewPath} fill={color} stroke="#374151" stroke-width="1" />
          </svg>
        </div>
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

      {#if shape === 'l-shape'}
        <div class="p-3 bg-slate-50 rounded-lg space-y-3">
          <Label class="text-slate-600">L-Shape Cutout</Label>
          <div class="grid grid-cols-3 gap-3">
            <div class="space-y-1">
              <Label for="cutoutWidth" class="text-xs">Cutout Width (cm)</Label>
              <Input
                id="cutoutWidth"
                type="number"
                bind:value={cutoutWidth}
                min={1}
                max={width - 1}
              />
            </div>
            <div class="space-y-1">
              <Label for="cutoutHeight" class="text-xs">Cutout Depth (cm)</Label>
              <Input
                id="cutoutHeight"
                type="number"
                bind:value={cutoutHeight}
                min={1}
                max={height - 1}
              />
            </div>
            <div class="space-y-1">
              <Label class="text-xs">Corner</Label>
              <Select.Root
                type="single"
                value={cutoutCorner}
                onValueChange={(v) => (cutoutCorner = v as CutoutCorner)}
              >
                <Select.Trigger class="h-9">
                  {cutoutCornerOptions.find(o => o.value === cutoutCorner)?.label}
                </Select.Trigger>
                <Select.Content>
                  {#each cutoutCornerOptions as option (option.value)}
                    <Select.Item value={option.value}>{option.label}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        </div>
      {/if}

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
        <Label for="price">Price</Label>
        <div class="flex gap-2">
          <Input
            id="price"
            type="number"
            step="0.01"
            min={0}
            bind:value={price}
            placeholder="Optional"
            class="flex-1"
          />
          <Select.Root
            type="single"
            value={priceCurrency}
            onValueChange={(v) => (priceCurrency = v as CurrencyCode)}
          >
            <Select.Trigger class="w-24">
              {priceCurrency}
            </Select.Trigger>
            <Select.Content>
              {#each CURRENCIES as curr (curr.code)}
                <Select.Item value={curr.code}>{curr.symbol} {curr.code}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
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
