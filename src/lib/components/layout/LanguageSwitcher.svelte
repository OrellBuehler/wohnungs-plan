<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { getLocale, setLocale, locales, type Locale } from '$lib/paraglide/runtime';
	import { Languages } from 'lucide-svelte';

	const locale = $derived(getLocale());

	const localeLabels: Record<string, string> = {
		en: 'English',
		de: 'Deutsch'
	};

	function handleChange(value: string) {
		if (value !== locale) {
			setLocale(value as Locale);
		}
	}
</script>

<div class="flex items-center gap-2">
	<Languages class="size-4 text-muted-foreground shrink-0" />
	<Select.Root type="single" value={locale} onValueChange={handleChange}>
		<Select.Trigger class="w-[120px] h-8 text-sm">
			{localeLabels[locale] ?? locale}
		</Select.Trigger>
		<Select.Content>
			{#each locales as loc}
				<Select.Item value={loc}>{localeLabels[loc] ?? loc}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
