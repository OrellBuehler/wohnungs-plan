<script lang="ts">
  import type { ItemImage } from '$lib/types';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import X from '@lucide/svelte/icons/x';
  import * as m from '$lib/paraglide/messages';

  interface Props {
    images: ItemImage[];
    initialIndex: number;
    open: boolean;
    onClose: () => void;
  }

  let { images, initialIndex, open = $bindable(), onClose }: Props = $props();

  let currentIndex = $state(0);

  $effect(() => {
    if (open) {
      currentIndex = initialIndex;
    }
  });

  const currentImage = $derived(images[Math.min(currentIndex, Math.max(images.length - 1, 0))]);
  const hasPrev = $derived(currentIndex > 0);
  const hasNext = $derived(currentIndex < images.length - 1);

  function prev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
  }

  function next() {
    currentIndex = (currentIndex + 1) % images.length;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
  }

  function handleClose() {
    open = false;
    onClose();
  }

  // Swipe gesture
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_THRESHOLD = 50;
  const MAX_VERTICAL = 80;

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchEnd(e: TouchEvent) {
    if (e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (dy > MAX_VERTICAL) return;
    if (dx < -SWIPE_THRESHOLD) next();
    else if (dx > SWIPE_THRESHOLD) prev();
  }
</script>

<Dialog.Root bind:open onOpenChange={(o) => !o && handleClose()}>
  <Dialog.Content
    class="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-black/95 overflow-hidden"
    showCloseButton={false}
    onkeydown={handleKeydown}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative flex items-center justify-center w-full h-[85vh]"
      ontouchstart={handleTouchStart}
      ontouchend={handleTouchEnd}
    >
      {#if currentImage}
        <img
          src={currentImage.url}
          alt={currentImage.originalName ?? m.item_form_image_alt()}
          class="max-w-full max-h-full object-contain"
        />
      {/if}

      <!-- Close button -->
      <Button
        variant="ghost"
        size="icon-sm"
        class="absolute top-3 right-3 text-white bg-black/50 hover:text-white hover:bg-black/70"
        onclick={handleClose}
      >
        <X size={20} />
      </Button>

      <!-- Navigation arrows -->
      {#if images.length > 1}
        {#if hasPrev}
          <Button
            variant="ghost"
            size="icon-sm"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:text-white hover:bg-black/70 h-10 w-10"
            onclick={prev}
          >
            <ChevronLeft size={24} />
          </Button>
        {/if}
        {#if hasNext}
          <Button
            variant="ghost"
            size="icon-sm"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:text-white hover:bg-black/70 h-10 w-10"
            onclick={next}
          >
            <ChevronRight size={24} />
          </Button>
        {/if}

        <!-- Dots indicator -->
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {#each images as _, i}
            <button
              type="button"
              class="w-2 h-2 rounded-full transition-colors {i === currentIndex ? 'bg-white' : 'bg-white/40'}"
              onclick={() => (currentIndex = i)}
              aria-label={m.image_viewer_view_image({ index: i + 1 })}
            ></button>
          {/each}
        </div>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
