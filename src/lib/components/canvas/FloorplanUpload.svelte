<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		onUpload: (imageData: string) => void;
	}

	let { onUpload }: Props = $props();
	let isDragging = $state(false);
	let fileInput: HTMLInputElement;
	let invalidFileDialogOpen = $state(false);

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) processFile(file);
	}

	function handleFileSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) processFile(file);
	}

	function processFile(file: File) {
		if (!file.type.startsWith('image/')) {
			invalidFileDialogOpen = true;
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			onUpload(reader.result as string);
		};
		reader.readAsDataURL(file);
	}
</script>

<div
	class="flex flex-col items-center justify-center h-full p-8 text-center transition-colors
         {isDragging ? 'bg-secondary/20' : 'bg-canvas-bg'}"
	ondragover={(e) => {
		e.preventDefault();
		isDragging = true;
	}}
	ondragleave={() => (isDragging = false)}
	ondrop={handleDrop}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
>
	<div class="bg-primary-container rounded-lg p-8 max-w-md">
		<svg
			viewBox="0 0 64 64"
			class="w-14 h-14 mx-auto mb-4 text-on-primary-container"
			fill="none"
			stroke="currentColor"
		>
			<rect x="8" y="8" width="48" height="48" rx="4" stroke-width="1.5" />
			<line x1="8" y1="28" x2="56" y2="28" stroke-width="1" opacity="0.4" />
			<line x1="8" y1="48" x2="56" y2="48" stroke-width="1" opacity="0.4" />
			<line x1="28" y1="8" x2="28" y2="56" stroke-width="1" opacity="0.4" />
			<line x1="48" y1="8" x2="48" y2="56" stroke-width="1" opacity="0.4" />
			<path d="M32 20 L32 44 M20 32 L44 32" stroke-width="2" stroke-linecap="round" />
		</svg>
		<h2 class="text-xl font-display font-semibold text-primary-foreground mb-2">
			{m.canvas_upload_title()}
		</h2>
		<p class="text-on-primary-container mb-2">
			{m.canvas_upload_description()}
		</p>
		<p class="text-on-primary-container/60 text-sm mb-6">
			{m.canvas_upload_hint()}
		</p>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			class="hidden"
			onchange={handleFileSelect}
		/>
		<Button onclick={() => fileInput.click()}>{m.canvas_upload_button()}</Button>
	</div>
</div>

<Dialog.Root bind:open={invalidFileDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.canvas_upload_invalid_title()}</Dialog.Title>
			<Dialog.Description>{m.canvas_upload_invalid_description()}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button class="w-full sm:w-auto" onclick={() => (invalidFileDialogOpen = false)}
				>{m.common_ok()}</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
