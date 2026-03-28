<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		activeTab: 'plan' | 'items' | 'comments';
		onTabChange: (tab: 'plan' | 'items' | 'comments') => void;
		unreadCount?: number;
	}

	let { activeTab, onTabChange, unreadCount = 0 }: Props = $props();
</script>

<nav
	class="bg-surface-container-lowest/80 backdrop-blur-[12px] flex md:hidden flex-shrink-0"
	style="padding-bottom: env(safe-area-inset-bottom);"
>
	<Button
		variant="ghost"
		class="flex-1 flex items-center justify-center gap-2 rounded-none h-14 {activeTab === 'plan'
			? 'text-on-surface bg-surface-container-high'
			: 'text-on-surface-variant'}"
		onclick={() => onTabChange('plan')}
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
			/>
		</svg>
		<span class="text-sm font-medium">{m.nav_plan()}</span>
	</Button>
	<Button
		variant="ghost"
		class="flex-1 flex items-center justify-center gap-2 rounded-none h-14 {activeTab === 'items'
			? 'text-on-surface bg-surface-container-high'
			: 'text-on-surface-variant'}"
		onclick={() => onTabChange('items')}
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
			/>
		</svg>
		<span class="text-sm font-medium">{m.nav_items()}</span>
	</Button>
	<Button
		variant="ghost"
		class="flex-1 flex items-center justify-center gap-2 rounded-none h-14 relative {activeTab ===
		'comments'
			? 'text-on-surface bg-surface-container-high'
			: 'text-on-surface-variant'}"
		onclick={() => onTabChange('comments')}
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
			/>
		</svg>
		<span class="text-sm font-medium">{m.nav_comments()}</span>
		{#if unreadCount > 0}
			<span
				class="absolute top-2 right-1/4 flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-secondary text-white text-[10px] font-bold px-0.5"
			>
				{unreadCount}
			</span>
		{/if}
	</Button>
</nav>
