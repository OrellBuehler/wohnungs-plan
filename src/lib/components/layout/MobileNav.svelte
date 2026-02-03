<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  interface Props {
    activeTab: 'plan' | 'items';
    onTabChange: (tab: 'plan' | 'items') => void;
  }

  let { activeTab, onTabChange }: Props = $props();
</script>

<nav class="h-14 bg-white border-t border-slate-200 flex md:hidden flex-shrink-0" style="padding-bottom: env(safe-area-inset-bottom);">
  <Button
    variant="ghost"
    class="flex-1 flex items-center justify-center gap-2 rounded-none h-full {activeTab === 'plan'
      ? 'text-blue-600 bg-blue-50'
      : 'text-slate-600'}"
    onclick={() => onTabChange('plan')}
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
    <span class="text-sm font-medium">Plan</span>
  </Button>
  <Button
    variant="ghost"
    class="flex-1 flex items-center justify-center gap-2 rounded-none h-full {activeTab === 'items'
      ? 'text-blue-600 bg-blue-50'
      : 'text-slate-600'}"
    onclick={() => onTabChange('items')}
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
    <span class="text-sm font-medium">Items</span>
  </Button>
</nav>
