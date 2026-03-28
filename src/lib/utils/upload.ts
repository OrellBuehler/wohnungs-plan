export function uploadWithProgress(
	url: string,
	formData: FormData,
	onProgress: (percent: number) => void,
	headers?: Record<string, string>
): Promise<{
	ok: boolean;
	status: number;
	statusText: string;
	text: () => Promise<string>;
	json: () => Promise<unknown>;
}> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				const percent = Math.round((event.loaded / event.total) * 100);
				onProgress(percent);
			}
		};

		xhr.onload = () => {
			const responseText = xhr.responseText;
			resolve({
				ok: xhr.status >= 200 && xhr.status < 300,
				status: xhr.status,
				statusText: xhr.statusText,
				text: () => Promise.resolve(responseText),
				json: () => Promise.resolve(JSON.parse(responseText))
			});
		};

		xhr.onerror = () => {
			reject(new Error('Network error during upload'));
		};

		xhr.open('POST', url);
		xhr.withCredentials = true;

		if (headers) {
			for (const [key, value] of Object.entries(headers)) {
				xhr.setRequestHeader(key, value);
			}
		}

		xhr.send(formData);
	});
}
