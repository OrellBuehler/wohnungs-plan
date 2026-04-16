<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';
	import { Button } from '$lib/components/ui/button';
	import { getLocale, setLocale, locales, type Locale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Users from '@lucide/svelte/icons/users';
	import GitBranch from '@lucide/svelte/icons/git-branch';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Share2 from '@lucide/svelte/icons/share-2';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import FileJson from '@lucide/svelte/icons/file-json';
	import Languages from '@lucide/svelte/icons/languages';
	import History from '@lucide/svelte/icons/history';

	const locale = $derived(getLocale());
	const GITHUB_URL = 'https://github.com/OrellBuehler/wohnungs-plan';

	function switchLocale(loc: Locale) {
		if (loc !== locale) setLocale(loc);
	}
</script>

<SEO
	title="Wohnungs-Plan — {m.app_description()}"
	description={m.app_description()}
	url="https://floorplanner.orellbuehler.ch"
/>

<div class="bg-surface text-on-surface min-h-dvh">
	<!-- ============== HEADER ============== -->
	<header class="sticky top-0 z-40 bg-surface/80 backdrop-blur-[12px]">
		<div class="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
			<a href="/" class="flex items-center gap-2.5">
				<img src="/icon.svg" alt="" class="size-7" />
				<span class="font-display text-lg font-extrabold tracking-tight">Wohnungs-Plan</span>
			</a>
			<nav class="flex items-center gap-1">
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
				<a
					href={GITHUB_URL}
					target="_blank"
					rel="noopener"
					class="hidden sm:inline-flex items-center justify-center size-9 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
					aria-label="GitHub"
				>
					<svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57v-2c-3.34.72-4.04-1.6-4.04-1.6-.55-1.38-1.33-1.75-1.33-1.75-1.08-.74.08-.73.08-.73 1.2.08 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.48 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.3.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.57A12 12 0 0 0 12 .3"
						/>
					</svg>
				</a>
				<Button href="/app" class="h-9">
					{m.landing_nav_open_app()}
					<ArrowRight class="size-4 ml-1.5" />
				</Button>
			</nav>
		</div>
	</header>

	<!-- ============== HERO ============== -->
	<section class="relative overflow-hidden">
		<!-- Grid backdrop -->
		<div class="absolute inset-0 grid-backdrop pointer-events-none"></div>
		<div
			class="absolute inset-x-0 top-0 h-[75%] bg-gradient-to-b from-transparent via-transparent to-surface pointer-events-none"
		></div>

		<div class="relative max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-20 pb-16 md:pb-28">
			<div class="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-center">
				<!-- Copy -->
				<div class="reveal" style="--reveal-delay: 0ms">
					<div
						class="inline-flex items-center gap-2 font-technical text-[11px] uppercase tracking-[0.18em] text-on-surface-variant mb-6"
					>
						<span class="inline-block size-1.5 rounded-full bg-secondary"></span>
						{m.landing_hero_label()}
					</div>
					<h1
						class="font-display font-extrabold text-on-surface tracking-[-0.03em] leading-[0.95] text-5xl sm:text-6xl lg:text-7xl"
					>
						{m.landing_hero_headline_a()}<br />
						<span class="text-on-surface-variant">{m.landing_hero_headline_b()}</span>
					</h1>
					<p class="mt-6 text-lg md:text-xl text-on-surface-variant max-w-[36ch] leading-relaxed">
						{m.landing_hero_subhead()}
					</p>
					<div class="mt-8 flex flex-wrap items-center gap-3">
						<Button href="/app" size="lg" class="h-12 px-6 text-base">
							{m.landing_hero_cta_primary()}
							<ArrowRight class="size-4 ml-2" />
						</Button>
						<Button href={GITHUB_URL} variant="ghost" size="lg" class="h-12 px-5 text-base">
							<svg class="size-4 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path
									d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57v-2c-3.34.72-4.04-1.6-4.04-1.6-.55-1.38-1.33-1.75-1.33-1.75-1.08-.74.08-.73.08-.73 1.2.08 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.48 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.3.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.57A12 12 0 0 0 12 .3"
								/>
							</svg>
							{m.landing_hero_cta_secondary()}
						</Button>
					</div>
					<div
						class="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-surface-variant"
					>
						<span class="inline-flex items-center gap-2">
							<span class="size-1 rounded-full bg-on-surface-variant/50"></span>
							{m.landing_hero_trust_free()}
						</span>
						<span class="inline-flex items-center gap-2">
							<span class="size-1 rounded-full bg-on-surface-variant/50"></span>
							{m.landing_hero_trust_os()}
						</span>
						<span class="inline-flex items-center gap-2">
							<span class="size-1 rounded-full bg-on-surface-variant/50"></span>
							{m.landing_hero_trust_ch()}
						</span>
					</div>
				</div>

				<!-- Mockup -->
				<div class="reveal" style="--reveal-delay: 120ms">
					<div class="relative aspect-[5/4] w-full max-w-[560px] mx-auto">
						<!-- Outer technical label -->
						<div
							class="absolute -top-6 left-0 font-technical text-[10px] uppercase tracking-[0.18em] text-on-surface-variant/70"
						>
							A-01 · HERO · LIVE
						</div>

						<!-- Card with floorplan -->
						<div
							class="absolute inset-0 bg-surface-container-lowest rounded-xl shadow-[0_24px_60px_-20px_rgba(19,27,46,0.18)] overflow-hidden"
						>
							<svg
								viewBox="0 0 500 400"
								class="absolute inset-0 w-full h-full"
								preserveAspectRatio="xMidYMid meet"
								role="img"
								aria-label="Floor plan preview"
							>
								<!-- Grid -->
								<defs>
									<pattern id="hero-grid" width="16" height="16" patternUnits="userSpaceOnUse">
										<path d="M 16 0 L 0 0 0 16" fill="none" stroke="#e0e3e5" stroke-width="0.5" />
									</pattern>
									<linearGradient id="sofa-g" x1="0%" y1="0%" x2="100%" y2="100%">
										<stop offset="0%" stop-color="#131b2e" stop-opacity="0.85" />
										<stop offset="100%" stop-color="#2a334a" stop-opacity="0.85" />
									</linearGradient>
								</defs>
								<rect width="500" height="400" fill="url(#hero-grid)" />

								<!-- Outer walls -->
								<g stroke="#191c1e" stroke-width="3" fill="none" stroke-linejoin="miter">
									<rect x="40" y="40" width="420" height="320" />
								</g>
								<!-- Interior wall dividing living / bedroom -->
								<line x1="300" y1="40" x2="300" y2="240" stroke="#191c1e" stroke-width="2" />
								<!-- Door opening -->
								<path
									d="M 300 240 A 40 40 0 0 0 340 280"
									fill="none"
									stroke="#76777d"
									stroke-width="1"
									stroke-dasharray="3,2"
								/>
								<line x1="300" y1="240" x2="300" y2="280" stroke="#f7f9fb" stroke-width="3" />
								<!-- Window on top wall -->
								<line x1="120" y1="40" x2="220" y2="40" stroke="#f7f9fb" stroke-width="5" />
								<line
									x1="120"
									y1="40"
									x2="220"
									y2="40"
									stroke="#191c1e"
									stroke-width="1"
									stroke-dasharray="2,2"
								/>

								<!-- Room labels -->
								<g
									class="font-technical"
									fill="#76777d"
									font-family="'Space Grotesk', monospace"
									font-size="10"
									letter-spacing="1.5"
								>
									<text x="170" y="62" text-anchor="middle"
										>{m.landing_hero_mockup_room_living().toUpperCase()}</text
									>
									<text x="380" y="62" text-anchor="middle"
										>{m.landing_hero_mockup_room_bed().toUpperCase()}</text
									>
								</g>

								<!-- Furniture: sofa -->
								<g class="hero-piece piece-1">
									<rect x="70" y="260" width="120" height="45" rx="4" fill="url(#sofa-g)" />
									<rect
										x="70"
										y="255"
										width="120"
										height="14"
										rx="3"
										fill="#131b2e"
										opacity="0.5"
									/>
								</g>
								<!-- coffee table -->
								<g class="hero-piece piece-2">
									<rect
										x="105"
										y="200"
										width="50"
										height="30"
										rx="2"
										fill="#d4a574"
										stroke="#b8956e"
										stroke-width="1"
									/>
								</g>
								<!-- rug behind -->
								<g class="hero-piece piece-0">
									<rect
										x="60"
										y="190"
										width="160"
										height="130"
										rx="2"
										fill="#2170e4"
										fill-opacity="0.08"
										stroke="#2170e4"
										stroke-opacity="0.35"
										stroke-width="1"
										stroke-dasharray="3,2"
									/>
								</g>
								<!-- chair -->
								<g class="hero-piece piece-3">
									<rect
										x="240"
										y="215"
										width="36"
										height="36"
										rx="4"
										fill="#d4a574"
										stroke="#b8956e"
										stroke-width="1"
									/>
								</g>
								<!-- bed -->
								<g class="hero-piece piece-4">
									<rect
										x="330"
										y="90"
										width="110"
										height="80"
										rx="3"
										fill="#131b2e"
										fill-opacity="0.9"
									/>
									<rect
										x="330"
										y="90"
										width="110"
										height="14"
										rx="2"
										fill="#ffffff"
										fill-opacity="0.25"
									/>
									<rect
										x="335"
										y="96"
										width="40"
										height="5"
										rx="1"
										fill="#ffffff"
										fill-opacity="0.4"
									/>
									<rect
										x="395"
										y="96"
										width="40"
										height="5"
										rx="1"
										fill="#ffffff"
										fill-opacity="0.4"
									/>
								</g>
								<!-- nightstand -->
								<g class="hero-piece piece-5">
									<rect
										x="330"
										y="180"
										width="28"
										height="22"
										rx="2"
										fill="#d4a574"
										stroke="#b8956e"
										stroke-width="1"
									/>
								</g>

								<!-- Dimension overlay (bottom) -->
								<g
									class="hero-dims"
									font-family="'Space Grotesk', monospace"
									fill="#45464d"
									font-size="11"
								>
									<line x1="40" y1="378" x2="460" y2="378" stroke="#76777d" stroke-width="0.5" />
									<line x1="40" y1="374" x2="40" y2="382" stroke="#76777d" stroke-width="0.5" />
									<line x1="460" y1="374" x2="460" y2="382" stroke="#76777d" stroke-width="0.5" />
									<rect x="225" y="369" width="50" height="18" fill="#f7f9fb" />
									<text x="250" y="382" text-anchor="middle"
										>{m.landing_hero_mockup_dim_width()}</text
									>
								</g>
								<g
									class="hero-dims"
									font-family="'Space Grotesk', monospace"
									fill="#45464d"
									font-size="11"
								>
									<line x1="478" y1="40" x2="478" y2="360" stroke="#76777d" stroke-width="0.5" />
									<line x1="474" y1="40" x2="482" y2="40" stroke="#76777d" stroke-width="0.5" />
									<line x1="474" y1="360" x2="482" y2="360" stroke="#76777d" stroke-width="0.5" />
									<rect x="466" y="191" width="24" height="18" fill="#f7f9fb" />
									<text x="478" y="204" text-anchor="middle" transform="rotate(-90 478 200)"
										>{m.landing_hero_mockup_dim_height()}</text
									>
								</g>
							</svg>

							<!-- Collaborator cursor -->
							<div class="absolute cursor-ghost" style="left: 58%; top: 62%;">
								<svg
									viewBox="0 0 24 24"
									class="w-4 h-4 drop-shadow"
									fill="#ff5a5f"
									stroke="#fff"
									stroke-width="1.5"
								>
									<path d="M5 3 L5 19 L9.5 14.5 L12.5 21 L15 20 L12 13.5 L18 13.5 Z" />
								</svg>
								<span
									class="absolute top-5 left-4 font-technical text-[10px] font-semibold uppercase tracking-wider bg-[#ff5a5f] text-white rounded px-1.5 py-0.5 shadow"
								>
									Anna
								</span>
							</div>
						</div>

						<!-- Floating tag chip -->
						<div
							class="absolute -bottom-4 -right-3 sm:-right-4 bg-surface-container-lowest shadow-lg rounded-lg px-3 py-2 flex items-center gap-2 reveal-float"
						>
							<span class="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
							<span class="font-technical text-[11px] uppercase tracking-wider text-on-surface"
								>3 online</span
							>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ============== FEATURES STRIP ============== -->
	<section class="bg-surface-container-low">
		<div class="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
			<div
				class="flex items-center gap-3 font-technical text-[11px] uppercase tracking-[0.18em] text-on-surface-variant mb-4"
			>
				<span class="h-px flex-none w-10 bg-on-surface-variant/30"></span>
				{m.landing_features_label()}
			</div>
			<h2
				class="font-display text-3xl md:text-5xl font-bold tracking-[-0.02em] max-w-3xl text-on-surface"
			>
				{m.landing_features_title()}
			</h2>

			<div class="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{#each [{ icon: Users, title: m.landing_feature_collab_title(), desc: m.landing_feature_collab_desc() }, { icon: GitBranch, title: m.landing_feature_branches_title(), desc: m.landing_feature_branches_desc() }, { icon: Sparkles, title: m.landing_feature_ai_title(), desc: m.landing_feature_ai_desc() }, { icon: Share2, title: m.landing_feature_share_title(), desc: m.landing_feature_share_desc() }] as f, i}
					{@const Icon = f.icon}
					<div
						class="bg-surface-container-lowest rounded-xl p-6 reveal"
						style="--reveal-delay: {i * 70}ms"
					>
						<div
							class="size-10 rounded-lg bg-surface-container-highest flex items-center justify-center mb-4"
						>
							<Icon class="size-5 text-on-surface" />
						</div>
						<h3 class="font-display text-base font-bold tracking-tight text-on-surface mb-1.5">
							{f.title}
						</h3>
						<p class="text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ============== HOW IT WORKS ============== -->
	<section class="bg-surface">
		<div class="max-w-6xl mx-auto px-4 md:px-8 py-20 md:py-32">
			<div
				class="flex items-center gap-3 font-technical text-[11px] uppercase tracking-[0.18em] text-on-surface-variant mb-4"
			>
				<span class="h-px flex-none w-10 bg-on-surface-variant/30"></span>
				{m.landing_how_label()}
			</div>
			<h2
				class="font-display text-3xl md:text-5xl font-bold tracking-[-0.02em] text-on-surface max-w-3xl"
			>
				{m.landing_how_title()}
			</h2>

			<div class="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
				<!-- Step 1 -->
				<div class="reveal" style="--reveal-delay: 0ms">
					<div class="bg-surface-container-low rounded-xl p-6 h-full flex flex-col">
						<div class="flex items-baseline justify-between mb-5">
							<span class="font-technical text-2xl font-bold tracking-tight text-on-surface"
								>01</span
							>
							<span
								class="font-technical text-[10px] uppercase tracking-wider text-on-surface-variant"
								>Upload</span
							>
						</div>
						<div
							class="aspect-[4/3] rounded-lg bg-surface-container-lowest p-4 mb-5 relative overflow-hidden"
						>
							<svg viewBox="0 0 200 150" class="w-full h-full">
								<defs>
									<pattern id="s1-grid" width="10" height="10" patternUnits="userSpaceOnUse">
										<path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e0e3e5" stroke-width="0.3" />
									</pattern>
								</defs>
								<rect width="200" height="150" fill="url(#s1-grid)" />
								<rect
									x="30"
									y="20"
									width="140"
									height="100"
									rx="4"
									fill="#ffffff"
									stroke="#c6c6cd"
									stroke-width="1"
									stroke-dasharray="4,3"
								/>
								<g stroke="#191c1e" stroke-width="1.5" fill="none">
									<rect x="45" y="35" width="110" height="70" />
									<line x1="100" y1="35" x2="100" y2="75" />
									<line x1="45" y1="75" x2="100" y2="75" />
								</g>
								<g fill="#5a6167" font-family="'Space Grotesk', monospace" font-size="7">
									<text x="100" y="135" text-anchor="middle">floorplan.png</text>
								</g>
								<!-- upload arrow -->
								<g transform="translate(100 60)">
									<circle r="14" fill="#131b2e" />
									<path
										d="M-4,1 L0,-5 L4,1 M0,-5 L0,5"
										stroke="#ffffff"
										stroke-width="1.5"
										fill="none"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</g>
							</svg>
						</div>
						<h3 class="font-display text-lg font-bold tracking-tight text-on-surface mb-2">
							{m.landing_how_step1_title()}
						</h3>
						<p class="text-sm text-on-surface-variant leading-relaxed">
							{m.landing_how_step1_desc()}
						</p>
					</div>
				</div>

				<!-- Step 2 -->
				<div class="reveal" style="--reveal-delay: 90ms">
					<div class="bg-surface-container-low rounded-xl p-6 h-full flex flex-col">
						<div class="flex items-baseline justify-between mb-5">
							<span class="font-technical text-2xl font-bold tracking-tight text-on-surface"
								>02</span
							>
							<span
								class="font-technical text-[10px] uppercase tracking-wider text-on-surface-variant"
								>Calibrate</span
							>
						</div>
						<div
							class="aspect-[4/3] rounded-lg bg-surface-container-lowest p-4 mb-5 relative overflow-hidden"
						>
							<svg viewBox="0 0 200 150" class="w-full h-full">
								<rect x="30" y="25" width="140" height="100" rx="3" fill="#ffffff" />
								<g stroke="#191c1e" stroke-width="1.2" fill="none">
									<rect x="45" y="40" width="110" height="70" />
								</g>
								<!-- calibration line -->
								<line
									x1="45"
									y1="40"
									x2="155"
									y2="40"
									stroke="#2170e4"
									stroke-width="1.5"
									stroke-dasharray="3,2"
								/>
								<circle cx="45" cy="40" r="4" fill="#2170e4" stroke="#ffffff" stroke-width="1.5" />
								<circle cx="155" cy="40" r="4" fill="#2170e4" stroke="#ffffff" stroke-width="1.5" />
								<g
									fill="#2170e4"
									font-family="'Space Grotesk', monospace"
									font-size="8"
									font-weight="600"
								>
									<rect
										x="86"
										y="20"
										width="28"
										height="14"
										rx="2"
										fill="#ffffff"
										stroke="#2170e4"
										stroke-width="0.8"
									/>
									<text x="100" y="30" text-anchor="middle">4.20m</text>
								</g>
							</svg>
						</div>
						<h3 class="font-display text-lg font-bold tracking-tight text-on-surface mb-2">
							{m.landing_how_step2_title()}
						</h3>
						<p class="text-sm text-on-surface-variant leading-relaxed">
							{m.landing_how_step2_desc()}
						</p>
					</div>
				</div>

				<!-- Step 3 -->
				<div class="reveal" style="--reveal-delay: 180ms">
					<div class="bg-surface-container-low rounded-xl p-6 h-full flex flex-col">
						<div class="flex items-baseline justify-between mb-5">
							<span class="font-technical text-2xl font-bold tracking-tight text-on-surface"
								>03</span
							>
							<span
								class="font-technical text-[10px] uppercase tracking-wider text-on-surface-variant"
								>Arrange</span
							>
						</div>
						<div
							class="aspect-[4/3] rounded-lg bg-surface-container-lowest p-4 mb-5 relative overflow-hidden"
						>
							<svg viewBox="0 0 200 150" class="w-full h-full">
								<defs>
									<pattern id="s3-grid" width="10" height="10" patternUnits="userSpaceOnUse">
										<path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e0e3e5" stroke-width="0.3" />
									</pattern>
								</defs>
								<rect width="200" height="150" fill="url(#s3-grid)" />
								<g stroke="#191c1e" stroke-width="1.5" fill="none">
									<rect x="30" y="25" width="140" height="100" />
								</g>
								<!-- pieces -->
								<rect x="45" y="40" width="50" height="20" rx="2" fill="#131b2e" opacity="0.8" />
								<rect
									x="115"
									y="40"
									width="40"
									height="25"
									rx="2"
									fill="#d4a574"
									stroke="#b8956e"
									stroke-width="0.5"
								/>
								<rect
									x="50"
									y="85"
									width="60"
									height="30"
									rx="2"
									fill="#2170e4"
									fill-opacity="0.2"
									stroke="#2170e4"
									stroke-opacity="0.5"
									stroke-width="0.8"
								/>
								<!-- dragged piece with cursor -->
								<rect
									x="125"
									y="85"
									width="30"
									height="28"
									rx="2"
									fill="#131b2e"
									opacity="0.6"
									stroke="#2170e4"
									stroke-width="1"
									stroke-dasharray="2,1"
								/>
								<g transform="translate(145 115)">
									<path
										d="M0,0 L0,10 L3,7 L5,12 L7,11 L5,7 L9,7 Z"
										fill="#ff5a5f"
										stroke="#ffffff"
										stroke-width="0.5"
									/>
								</g>
								<!-- dim -->
								<g fill="#5a6167" font-family="'Space Grotesk', monospace" font-size="7">
									<text x="125" y="80" text-anchor="start">0.80 × 0.80m</text>
								</g>
							</svg>
						</div>
						<h3 class="font-display text-lg font-bold tracking-tight text-on-surface mb-2">
							{m.landing_how_step3_title()}
						</h3>
						<p class="text-sm text-on-surface-variant leading-relaxed">
							{m.landing_how_step3_desc()}
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ============== SECONDARY FEATURES ============== -->
	<section class="bg-surface-container-low">
		<div class="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
			<div
				class="flex items-center gap-3 font-technical text-[11px] uppercase tracking-[0.18em] text-on-surface-variant mb-4"
			>
				<span class="h-px flex-none w-10 bg-on-surface-variant/30"></span>
				{m.landing_more_label()}
			</div>
			<h2
				class="font-display text-2xl md:text-4xl font-bold tracking-[-0.02em] text-on-surface max-w-3xl"
			>
				{m.landing_more_title()}
			</h2>

			<div
				class="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-outline-variant/30 rounded-xl overflow-hidden"
			>
				{#each [{ icon: WifiOff, title: m.landing_more_pwa_title(), desc: m.landing_more_pwa_desc() }, { icon: MessageSquare, title: m.landing_more_comments_title(), desc: m.landing_more_comments_desc() }, { icon: FileJson, title: m.landing_more_export_title(), desc: m.landing_more_export_desc() }, { icon: Languages, title: m.landing_more_i18n_title(), desc: m.landing_more_i18n_desc() }, { icon: History, title: m.landing_more_history_title(), desc: m.landing_more_history_desc() }] as f}
					{@const Icon = f.icon}
					<div class="bg-surface-container-lowest p-6 flex items-start gap-4">
						<div
							class="size-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-none"
						>
							<Icon class="size-4 text-on-surface" />
						</div>
						<div class="min-w-0">
							<h3 class="font-display text-sm font-bold tracking-tight text-on-surface">
								{f.title}
							</h3>
							<p class="text-sm text-on-surface-variant mt-1 leading-relaxed">{f.desc}</p>
						</div>
					</div>
				{/each}
				<!-- Filler tile to round out the grid when 5 items on 3 cols -->
				<div class="hidden lg:block bg-surface-container-lowest p-6 relative overflow-hidden">
					<div class="absolute inset-0 grid-backdrop opacity-60"></div>
					<div class="relative h-full flex flex-col justify-between">
						<span
							class="font-technical text-[10px] uppercase tracking-wider text-on-surface-variant"
							>&amp; more</span
						>
						<span
							class="font-display text-4xl font-bold tracking-[-0.03em] text-on-surface leading-none"
							>∞</span
						>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ============== FINAL CTA ============== -->
	<section class="bg-surface relative overflow-hidden">
		<div class="absolute inset-0 grid-backdrop opacity-60 pointer-events-none"></div>
		<div class="relative max-w-4xl mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
			<div
				class="inline-flex items-center gap-2 font-technical text-[11px] uppercase tracking-[0.18em] text-on-surface-variant mb-5"
			>
				<span class="inline-block size-1.5 rounded-full bg-secondary"></span>
				{m.landing_cta_label()}
			</div>
			<h2
				class="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-on-surface leading-[0.95]"
			>
				{m.landing_cta_title()}
			</h2>
			<p class="mt-5 text-lg text-on-surface-variant">{m.landing_cta_subtitle()}</p>
			<div class="mt-8">
				<Button href="/app" size="lg" class="h-12 px-7 text-base">
					{m.landing_cta_button()}
					<ArrowRight class="size-4 ml-2" />
				</Button>
			</div>
		</div>
	</section>

	<!-- ============== FOOTER ============== -->
	<footer class="bg-surface-container-low">
		<div class="max-w-6xl mx-auto px-4 md:px-8 py-12">
			<div class="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_1fr] gap-8 md:gap-10 pb-10">
				<div>
					<div class="flex items-center gap-2.5">
						<img src="/icon.svg" alt="" class="size-6" />
						<span class="font-display text-base font-extrabold tracking-tight">Wohnungs-Plan</span>
					</div>
					<p class="mt-3 text-sm text-on-surface-variant max-w-[32ch] leading-relaxed">
						{m.landing_footer_tagline()}
					</p>
					<p
						class="mt-4 font-technical text-[11px] uppercase tracking-wider text-on-surface-variant/70"
					>
						{m.landing_footer_license()}
					</p>
				</div>

				<div>
					<h3
						class="font-technical text-[11px] uppercase tracking-wider text-on-surface-variant mb-4"
					>
						{m.landing_footer_section_product()}
					</h3>
					<ul class="space-y-2.5">
						<li>
							<a href="/app" class="text-sm text-on-surface hover:text-secondary transition-colors"
								>{m.landing_footer_link_app()}</a
							>
						</li>
						<li>
							<a
								href={GITHUB_URL}
								target="_blank"
								rel="noopener"
								class="text-sm text-on-surface hover:text-secondary transition-colors inline-flex items-center gap-1.5"
							>
								{m.landing_footer_link_github()}
								<span aria-hidden="true" class="text-xs">↗</span>
							</a>
						</li>
					</ul>
				</div>

				<div>
					<h3
						class="font-technical text-[11px] uppercase tracking-wider text-on-surface-variant mb-4"
					>
						{m.landing_footer_section_legal()}
					</h3>
					<ul class="space-y-2.5">
						<li>
							<a
								href="/privacy"
								class="text-sm text-on-surface hover:text-secondary transition-colors"
								>{m.landing_footer_link_privacy()}</a
							>
						</li>
					</ul>
				</div>

				<div>
					<h3
						class="font-technical text-[11px] uppercase tracking-wider text-on-surface-variant mb-4"
					>
						{m.landing_footer_section_language()}
					</h3>
					<div class="flex gap-2">
						{#each locales as loc}
							<button
								type="button"
								onclick={() => switchLocale(loc)}
								class="px-3 h-8 rounded-lg text-xs font-technical uppercase tracking-wider transition-colors {loc ===
								locale
									? 'bg-surface-container-high text-on-surface'
									: 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'}"
								aria-pressed={loc === locale}
							>
								{loc}
							</button>
						{/each}
					</div>
				</div>
			</div>
			<div
				class="pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-on-surface-variant"
			>
				<div class="font-technical uppercase tracking-wider">
					© 2026 · {m.landing_footer_copyright()}
				</div>
				<div class="font-technical uppercase tracking-wider opacity-60">
					v {import.meta.env.VITE_APP_VERSION || 'dev'}
				</div>
			</div>
		</div>
	</footer>
</div>

<style>
	.grid-backdrop {
		background-image:
			linear-gradient(to right, rgba(25, 28, 30, 0.05) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(25, 28, 30, 0.05) 1px, transparent 1px);
		background-size: 32px 32px;
		mask-image: radial-gradient(ellipse at center top, black 40%, transparent 80%);
		-webkit-mask-image: radial-gradient(ellipse at center top, black 40%, transparent 80%);
	}

	.reveal {
		animation: reveal 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
		animation-delay: var(--reveal-delay, 0ms);
	}

	.reveal-float {
		animation: reveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
		animation-delay: 500ms;
	}

	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.hero-piece {
		transform-origin: center;
		opacity: 0;
		animation: piece-in 0.55s cubic-bezier(0.2, 0.9, 0.2, 1.05) both;
	}
	.hero-piece.piece-0 {
		animation-delay: 400ms;
	}
	.hero-piece.piece-1 {
		animation-delay: 520ms;
	}
	.hero-piece.piece-2 {
		animation-delay: 620ms;
	}
	.hero-piece.piece-3 {
		animation-delay: 720ms;
	}
	.hero-piece.piece-4 {
		animation-delay: 820ms;
	}
	.hero-piece.piece-5 {
		animation-delay: 920ms;
	}

	@keyframes piece-in {
		0% {
			opacity: 0;
			transform: translateY(6px) scale(0.92);
		}
		60% {
			opacity: 1;
			transform: translateY(-1px) scale(1.01);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.hero-dims {
		opacity: 0;
		animation: fade-in 0.5s ease-out 1100ms both;
	}

	.cursor-ghost {
		animation:
			cursor-fade 0.4s ease-out 1200ms both,
			cursor-drift 6s ease-in-out 1500ms infinite;
	}

	@keyframes cursor-fade {
		from {
			opacity: 0;
			transform: translate(-6px, -6px);
		}
		to {
			opacity: 1;
			transform: translate(0, 0);
		}
	}
	@keyframes cursor-drift {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(-18px, -10px);
		}
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.reveal,
		.reveal-float,
		.hero-piece,
		.hero-dims,
		.cursor-ghost {
			animation: none !important;
			opacity: 1 !important;
			transform: none !important;
		}
	}
</style>
