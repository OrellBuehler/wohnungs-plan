<script lang="ts">
  import type { Item, ItemImage, ItemShape, CutoutCorner } from '$lib/types';
  import type { CurrencyCode } from '$lib/utils/currency';
  import { CURRENCIES, DEFAULT_CURRENCY } from '$lib/utils/currency';
  import { getLShapePoints, getRectPoints } from '$lib/utils/geometry';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { ImagePlus, X, Loader2 } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';

  interface Props {
    open: boolean;
    item: Partial<Item> | null;
    defaultCurrency: CurrencyCode;
    existingImages?: ItemImage[];
    onSave: (item: Omit<Item, 'id'>, pendingFiles?: File[]) => void;
    onClose: () => void;
    onImageUpload?: (file: File) => Promise<ItemImage | null>;
    onImageDelete?: (imageId: string) => void;
    hidePositionFields?: boolean;
  }

  let { open = $bindable(), item, defaultCurrency, existingImages = [], onSave, onClose, onImageUpload, onImageDelete, hidePositionFields = false }: Props = $props();

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

  // Image upload state
  let pendingFiles = $state<File[]>([]);
  let pendingPreviews = $state<string[]>([]);
  let isUploading = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let deleteImageId = $state<string | null>(null);
  let showDeleteConfirm = $state(false);

  const isEditing = $derived(!!item?.id);

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

  const cutoutCornerOptions = $derived<{ value: CutoutCorner; label: string }[]>([
    { value: 'top-left', label: m.item_form_corner_top_left() },
    { value: 'top-right', label: m.item_form_corner_top_right() },
    { value: 'bottom-left', label: m.item_form_corner_bottom_left() },
    { value: 'bottom-right', label: m.item_form_corner_bottom_right() },
  ]);

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
      pendingFiles = [];
      pendingPreviews = [];
      isUploading = false;
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

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    if (isEditing && onImageUpload) {
      // Existing item: upload immediately
      isUploading = true;
      try {
        for (const file of files) {
          await onImageUpload(file);
        }
      } finally {
        isUploading = false;
      }
    } else {
      // New item: queue files for upload after save
      for (const file of files) {
        pendingFiles = [...pendingFiles, file];
        const url = URL.createObjectURL(file);
        pendingPreviews = [...pendingPreviews, url];
      }
    }

    // Reset the input so the same file can be selected again
    input.value = '';
  }

  function removePendingFile(index: number) {
    URL.revokeObjectURL(pendingPreviews[index]);
    pendingFiles = pendingFiles.filter((_, i) => i !== index);
    pendingPreviews = pendingPreviews.filter((_, i) => i !== index);
  }

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

    onSave(itemData, pendingFiles.length > 0 ? pendingFiles : undefined);
    onClose();
  }

  function handleClose() {
    // Clean up object URLs
    for (const url of pendingPreviews) {
      URL.revokeObjectURL(url);
    }
    open = false;
    onClose();
  }
</script>

<Dialog.Root bind:open onOpenChange={(o) => !o && handleClose()}>
  <Dialog.Content class="top-0 left-0 right-0 bottom-0 translate-x-0 translate-y-0 max-w-full max-h-[100dvh] flex flex-col overflow-hidden rounded-none p-4 sm:top-[50%] sm:left-[50%] sm:right-auto sm:bottom-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-md sm:max-h-[min(90vh,700px)] sm:rounded-lg sm:p-6">
    <Dialog.Header>
      <Dialog.Title>{item?.name ? m.item_form_edit_title() : m.item_form_add_title()}</Dialog.Title>
    </Dialog.Header>

    <form onsubmit={handleSubmit} class="space-y-4 overflow-y-auto flex-1 min-h-0 px-0.5">
      <div class="space-y-2">
        <Label for="name">{m.item_form_name_label()}</Label>
        <Input id="name" bind:value={name} placeholder={m.item_form_name_placeholder()} required />
      </div>

      <!-- Shape selector with preview -->
      <div class="space-y-2">
        <Label>{m.item_form_shape_label()}</Label>
        <div class="flex items-center gap-4">
          <div class="flex gap-2">
            <Button
              type="button"
              variant={shape === 'rectangle' ? 'default' : 'outline'}
              size="sm"
              onclick={() => (shape = 'rectangle')}
            >
              {m.item_form_shape_rectangle()}
            </Button>
            <Button
              type="button"
              variant={shape === 'l-shape' ? 'default' : 'outline'}
              size="sm"
              onclick={() => (shape = 'l-shape')}
            >
              {m.item_form_shape_lshape()}
            </Button>
          </div>
          <svg width="60" height="40" class="border rounded bg-slate-50">
            <path d={previewPath} fill={color} stroke="#374151" stroke-width="1" />
          </svg>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label for="width">{m.item_form_width_label()}</Label>
          <Input id="width" type="number" bind:value={width} min={1} required />
        </div>
        <div class="space-y-2">
          <Label for="height">{m.item_form_length_label()}</Label>
          <Input id="height" type="number" bind:value={height} min={1} required />
        </div>
      </div>

      {#if shape === 'l-shape'}
        <div class="p-3 bg-slate-50 rounded-lg space-y-3">
          <Label class="text-slate-600">{m.item_form_lshape_cutout()}</Label>
          <div class="grid grid-cols-3 gap-3">
            <div class="space-y-1">
              <Label for="cutoutWidth" class="text-xs">{m.item_form_cutout_width()}</Label>
              <Input
                id="cutoutWidth"
                type="number"
                bind:value={cutoutWidth}
                min={1}
                max={width - 1}
              />
            </div>
            <div class="space-y-1">
              <Label for="cutoutHeight" class="text-xs">{m.item_form_cutout_length()}</Label>
              <Input
                id="cutoutHeight"
                type="number"
                bind:value={cutoutHeight}
                min={1}
                max={height - 1}
              />
            </div>
            <div class="space-y-1">
              <Label class="text-xs">{m.item_form_corner_label()}</Label>
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
        <Label>{m.item_form_color_label()}</Label>
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
        <Label for="price">{m.item_form_price_label()}</Label>
        <div class="flex gap-2">
          <Input
            id="price"
            type="number"
            step="0.01"
            min={0}
            bind:value={price}
            placeholder={m.item_form_price_placeholder()}
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
        <Label for="url">{m.item_form_url_label()}</Label>
        <Input
          id="url"
          type="url"
          bind:value={productUrl}
          placeholder="https://..."
        />
      </div>

      <!-- Images section -->
      <div class="space-y-2">
        <Label>{m.item_form_images_label()}</Label>
        <div class="flex gap-2 flex-wrap">
          {#each existingImages as img (img.id)}
            <div class="relative group w-16 h-16 rounded border border-slate-200 overflow-hidden">
              <img src={img.thumbUrl} alt={img.originalName ?? m.item_form_image_alt()} class="w-full h-full object-cover" />
              {#if onImageDelete}
                <button
                  type="button"
                  class="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5 opacity-70 hover:opacity-100 transition-opacity"
                  onclick={() => { deleteImageId = img.id; showDeleteConfirm = true; }}
                >
                  <X size={12} />
                </button>
              {/if}
            </div>
          {/each}
          {#each pendingPreviews as preview, i}
            <div class="relative group w-16 h-16 rounded border border-dashed border-blue-300 overflow-hidden">
              <img src={preview} alt={m.item_form_image_pending_alt()} class="w-full h-full object-cover opacity-70" />
              <button
                type="button"
                class="absolute top-0 right-0 bg-black/60 text-white rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onclick={() => removePendingFile(i)}
              >
                <X size={12} />
              </button>
            </div>
          {/each}
          <button
            type="button"
            class="w-16 h-16 rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors"
            onclick={() => fileInputEl?.click()}
            disabled={isUploading}
          >
            {#if isUploading}
              <Loader2 size={20} class="animate-spin" />
            {:else}
              <ImagePlus size={20} />
            {/if}
          </button>
        </div>
        <input
          bind:this={fileInputEl}
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          onchange={handleFileSelect}
        />
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={handleClose}>{m.common_cancel()}</Button>
        <Button type="submit">{m.common_save()}</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={showDeleteConfirm}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{m.confirm_delete_image()}</AlertDialog.Title>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
      <AlertDialog.Action
        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onclick={() => {
          if (deleteImageId && onImageDelete) {
            onImageDelete(deleteImageId);
          }
          deleteImageId = null;
        }}
      >
        {m.common_delete()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
