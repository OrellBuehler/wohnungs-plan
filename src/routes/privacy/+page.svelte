<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';
	import { Button } from '$lib/components/ui/button';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { getLocale, setLocale, locales, type Locale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	const locale = $derived(getLocale());
	const GITHUB_URL = 'https://github.com/OrellBuehler/wohnungs-plan';

	function switchLocale(loc: Locale) {
		if (loc !== locale) setLocale(loc);
	}

	const sections = $derived([
		{ heading: m.privacy_h_data(), body: null, list: true },
		{ heading: m.privacy_h_not_collected(), body: m.privacy_not_collected() },
		{ heading: m.privacy_h_use(), body: m.privacy_use() },
		{ heading: m.privacy_h_storage(), body: m.privacy_storage() },
		{ heading: m.privacy_h_third_parties(), body: null, thirdParties: true },
		{ heading: m.privacy_h_collab(), body: m.privacy_collab() },
		{ heading: m.privacy_h_oauth(), body: m.privacy_oauth() },
		{ heading: m.privacy_h_offline(), body: m.privacy_offline() },
		{ heading: m.privacy_h_retention(), body: m.privacy_retention() },
		{ heading: m.privacy_h_children(), body: m.privacy_children() },
		{ heading: m.privacy_h_changes(), body: m.privacy_changes() },
		{ heading: m.privacy_h_contact(), body: null, contact: true }
	]);
</script>

<SEO
	title="{m.privacy_title()} — Wohnungs-Plan"
	description={m.privacy_intro()}
	url="https://floorplanner.orellbuehler.ch/privacy"
/>

<div class="bg-surface text-on-surface min-h-dvh">
	<!-- Header -->
	<header class="bg-surface/80 backdrop-blur-[12px] sticky top-0 z-10">
		<div class="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
			<a href="/" class="flex items-center gap-2.5">
				<img src="/icon.svg" alt="" class="size-7" />
				<span class="font-display text-lg font-extrabold tracking-tight">Wohnungs-Plan</span>
			</a>
			<div class="flex items-center gap-1">
				<div
					class="hidden sm:flex items-center gap-0.5 px-1 mr-2 text-xs font-technical tracking-wider uppercase text-on-surface-variant"
				>
					{#each locales as loc}
						<button
							type="button"
							onclick={() => switchLocale(loc)}
							class="px-2 py-1 rounded transition-colors {loc === locale
								? 'text-on-surface bg-surface-container-high'
								: 'hover:text-on-surface'}"
							aria-pressed={loc === locale}
						>
							{loc}
						</button>
					{/each}
				</div>
				<Button href="/" variant="ghost" size="sm" class="h-9">
					<ArrowLeft class="size-4 mr-1.5" />
					{m.privacy_back()}
				</Button>
			</div>
		</div>
	</header>

	<main class="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-20">
		<div
			class="flex items-center gap-3 font-technical text-[11px] uppercase tracking-[0.18em] text-on-surface-variant mb-4"
		>
			<span class="h-px flex-none w-10 bg-on-surface-variant/30"></span>
			{m.privacy_label()}
		</div>
		<h1
			class="font-display text-4xl md:text-5xl font-extrabold tracking-[-0.03em] text-on-surface leading-[1]"
		>
			{m.privacy_title()}
		</h1>
		<p class="mt-3 font-technical text-xs uppercase tracking-wider text-on-surface-variant">
			{m.privacy_effective()}
		</p>

		<div class="mt-10 bg-surface-container-low rounded-xl p-6 md:p-8">
			<p class="text-base md:text-[17px] leading-[1.7] text-on-surface">
				{m.privacy_intro()}
			</p>
		</div>

		<div class="mt-14 space-y-12">
			{#each sections as s, i}
				<section>
					<div class="flex items-center gap-3 mb-3">
						<span class="font-technical text-sm font-semibold text-on-surface-variant tabular-nums">
							{String(i + 1).padStart(2, '0')}
						</span>
						<h2
							class="font-display text-xl md:text-2xl font-bold tracking-[-0.02em] text-on-surface"
						>
							{s.heading}
						</h2>
					</div>
					{#if s.list}
						<p class="text-base leading-[1.7] text-on-surface-variant">{m.privacy_data_intro()}</p>
						<ul class="mt-4 space-y-3">
							{#each [m.privacy_data_account(), m.privacy_data_projects(), m.privacy_data_uploads(), m.privacy_data_sharing(), m.privacy_data_oauth(), m.privacy_data_session()] as item}
								<li class="relative pl-6 text-base leading-[1.7] text-on-surface-variant">
									<span
										aria-hidden="true"
										class="absolute left-0 top-[0.62em] size-[6px] rounded-full bg-on-surface-variant/60"
									></span>
									{item}
								</li>
							{/each}
						</ul>
					{:else if s.thirdParties}
						<p class="text-base leading-[1.7] text-on-surface-variant">{m.privacy_tp_intro()}</p>
						<ul class="mt-4 space-y-3">
							<li class="relative pl-6 text-base leading-[1.7] text-on-surface-variant">
								<span
									aria-hidden="true"
									class="absolute left-0 top-[0.62em] size-[6px] rounded-full bg-on-surface-variant/60"
								></span>
								{m.privacy_tp_infomaniak()}
							</li>
						</ul>
						<p class="mt-4 text-base leading-[1.7] text-on-surface-variant">
							{m.privacy_tp_none()}
						</p>
					{:else if s.contact}
						<p class="text-base leading-[1.7] text-on-surface-variant">{m.privacy_contact()}</p>
						<a
							href="{GITHUB_URL}/issues"
							target="_blank"
							rel="noopener"
							class="mt-4 inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-surface-container-highest text-on-surface font-technical text-sm uppercase tracking-wider hover:bg-surface-container-high transition-colors"
						>
							GitHub Issues
							<span aria-hidden="true">↗</span>
						</a>
					{:else}
						<p class="text-base leading-[1.7] text-on-surface-variant">{s.body}</p>
					{/if}
				</section>
			{/each}
		</div>

		<div
			class="mt-20 pt-8 border-t border-outline-variant/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-technical uppercase tracking-wider text-on-surface-variant"
		>
			<a href="/" class="hover:text-on-surface transition-colors">← Wohnungs-Plan</a>
			<span>{m.privacy_effective()}</span>
		</div>
	</main>
</div>
