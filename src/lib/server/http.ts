export function isSafeRedirectPath(value: string): boolean {
	if (!value.startsWith('/')) return false;
	if (value.startsWith('//')) return false;
	if (value.includes('://')) return false;
	return true;
}

export function isSecureRequest(url: URL, headers: Headers): boolean {
	const forwardedProto = headers.get('x-forwarded-proto');
	if (forwardedProto) {
		const first = forwardedProto.split(',')[0]?.trim().toLowerCase();
		if (first === 'https') return true;
		if (first === 'http') return false;
	}

	const forwarded = headers.get('forwarded');
	if (forwarded) {
		const match = forwarded.match(/proto=([^;,\s]+)/i);
		if (match?.[1]) {
			const proto = match[1].trim().toLowerCase();
			if (proto === 'https') return true;
			if (proto === 'http') return false;
		}
	}

	return url.protocol === 'https:';
}
