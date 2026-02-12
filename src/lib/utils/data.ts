export function parseDataUrl(dataUrl: string): { data: Blob; mimeType: string } {
	const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
	if (!match) {
		return {
			data: new Blob([dataUrl], { type: 'image/png' }),
			mimeType: 'image/png'
		};
	}

	const mimeType = match[1] || 'image/png';
	const binary = atob(match[2]);
	const buffer = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		buffer[i] = binary.charCodeAt(i);
	}

	return { data: new Blob([buffer], { type: mimeType }), mimeType };
}
