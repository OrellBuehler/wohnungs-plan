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
         {isDragging ? 'bg-blue-500/20' : 'bg-canvas-bg'}"
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
	<div class="bg-slate-800 rounded-lg p-8 max-w-md">
		<svg
			class="w-16 h-16 mx-auto mb-4 text-slate-400"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
			/>
		</svg>
		<h2 class="text-xl font-semibold text-white mb-2">{m.canvas_upload_title()}</h2>
		<p class="text-slate-400 mb-6">
			{m.canvas_upload_description()}
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
