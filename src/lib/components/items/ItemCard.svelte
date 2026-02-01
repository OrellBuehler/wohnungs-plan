<script lang="ts">
  import type { Item } from '$lib/types';
  import type { CurrencyCode } from '$lib/utils/currency';
  import { getCurrencySymbol } from '$lib/utils/currency';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';

  interface Props {
    item: Item;
    isSelected: boolean;
    currency: CurrencyCode;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onPlace: () => void;
  }

  let { item, isSelected, currency, onSelect, onEdit, onDelete, onDuplicate, onPlace }: Props = $props();

  const currencySymbol = $derived(getCurrencySymbol(currency));

  function withStopPropagation(handler: () => void) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      handler();
    };
  }
</script>

<Card.Root
  class="cursor-pointer transition-colors {isSelected
    ? 'border-blue-500 bg-blue-50'
    : 'hover:border-slate-300'}"
  onclick={onSelect}
  role="button"
  tabindex={0}
  onkeydown={(e) => e.key === 'Enter' && onSelect()}
>
  <Card.Content class="p-3">
    <div class="flex items-start gap-3">
      <div
        class="w-8 h-8 rounded flex-shrink-0"
        style="background-color: {item.color}"
      ></div>

      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-slate-800 truncate">{item.name}</h3>
        <p class="text-sm text-slate-500 font-mono">
          {item.width} x {item.height} cm
        </p>
        {#if item.price !== null}
          <p class="text-sm font-medium text-slate-700">{currencySymbol}{item.price.toFixed(2)}</p>
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
      <Separator class="my-3" />
      <div class="flex gap-2">
        <Button size="sm" variant="outline" onclick={withStopPropagation(onEdit)}>
          Edit
        </Button>
        {#if !item.position}
          <Button size="sm" variant="outline" onclick={withStopPropagation(onPlace)}>
            Place
          </Button>
        {/if}
        <Button size="sm" variant="outline" onclick={withStopPropagation(onDuplicate)}>
          Duplicate
        </Button>
        <Button size="sm" variant="destructive" onclick={withStopPropagation(onDelete)}>
          Delete
        </Button>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
