import { resolve4, resolve6 } from 'node:dns/promises';
import { config } from './env';
import { detectImageMime, type AllowedMimeType } from './image-utils';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'WohnungsPlan/1.0 (Image Downloader)';

// IPv4 private/reserved ranges as [prefix, mask]
const BLOCKED_IPV4_RANGES: [number, number][] = [
	[0x7f000000, 0xff000000], // 127.0.0.0/8
	[0x0a000000, 0xff000000], // 10.0.0.0/8
	[0xac100000, 0xfff00000], // 172.16.0.0/12
	[0xc0a80000, 0xffff0000], // 192.168.0.0/16
	[0xa9fe0000, 0xffff0000], // 169.254.0.0/16
	[0x00000000, 0xff000000] // 0.0.0.0/8
];

function parseIPv4(ip: string): number | null {
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let result = 0;
	for (const part of parts) {
		const n = Number(part);
		if (!Number.isInteger(n) || n < 0 || n > 255) return null;
		result = (result << 8) | n;
	}
	return result >>> 0; // unsigned
}

function isPrivateIPv4(ip: string): boolean {
	const num = parseIPv4(ip);
	if (num === null) return true; // reject unparseable
	for (const [prefix, mask] of BLOCKED_IPV4_RANGES) {
		if ((num & mask) === prefix) return true;
	}
	return false;
}

function isPrivateIPv6(ip: string): boolean {
	const lower = ip.toLowerCase();
	if (lower === '::1') return true;
	if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 (ULA)
	if (lower.startsWith('fe80')) return true; // fe80::/10 (link-local)

	// IPv4-mapped: ::ffff:x.x.x.x
	const mappedMatch = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (mappedMatch) return isPrivateIPv4(mappedMatch[1]);

	return false;
}

async function validateHost(hostname: string): Promise<void> {
	// If hostname is already an IP literal, check directly
	if (parseIPv4(hostname) !== null) {
		if (isPrivateIPv4(hostname)) {
			throw new Error('URL resolves to a private IP address.');
		}
		return;
	}

	let hasResults = false;

	try {
		const ipv4s = await resolve4(hostname);
		for (const ip of ipv4s) {
			if (isPrivateIPv4(ip)) {
				throw new Error('URL resolves to a private IP address.');
			}
		}
		hasResults = ipv4s.length > 0;
	} catch (err) {
		if ((err as Error).message === 'URL resolves to a private IP address.') throw err;
		// DNS resolution may fail for IPv4 if only AAAA records exist
	}

	try {
		const ipv6s = await resolve6(hostname);
		for (const ip of ipv6s) {
			if (isPrivateIPv6(ip)) {
				throw new Error('URL resolves to a private IP address.');
			}
		}
		hasResults = hasResults || ipv6s.length > 0;
	} catch (err) {
		if ((err as Error).message === 'URL resolves to a private IP address.') throw err;
		// DNS resolution may fail for IPv6 if only A records exist
	}

	if (!hasResults) {
		throw new Error('Could not resolve hostname.');
	}
}

function validateUrl(url: string): URL {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error('Invalid URL.');
	}

	if (parsed.protocol !== 'https:') {
		throw new Error('Only HTTPS URLs are allowed.');
	}

	return parsed;
}

export interface DownloadResult {
	buffer: Buffer;
	mimeType: AllowedMimeType;
	sizeBytes: number;
	originalUrl: string;
}

export async function downloadImageFromUrl(url: string): Promise<DownloadResult> {
	const maxSize = config.uploads.maxImageSize;
	let currentUrl = url;

	for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
		const parsed = validateUrl(currentUrl);
		await validateHost(parsed.hostname);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		let response: Response;
		try {
			response = await fetch(currentUrl, {
				method: 'GET',
				headers: { 'User-Agent': USER_AGENT },
				redirect: 'manual',
				signal: controller.signal
			});
		} catch (err) {
			throw new Error(
				`Download failed: ${(err as Error).name === 'AbortError' ? 'Request timed out.' : (err as Error).message}`
			);
		} finally {
			clearTimeout(timeout);
		}

		// Handle redirects manually to re-validate each hop
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) throw new Error('Redirect without Location header.');
			// Resolve relative redirects
			currentUrl = new URL(location, currentUrl).href;
			continue;
		}

		if (!response.ok) {
			throw new Error(`Download failed with status ${response.status}.`);
		}

		// Check Content-Length if available
		const contentLength = response.headers.get('content-length');
		if (contentLength && Number(contentLength) > maxSize) {
			throw new Error(`Image too large (${Number(contentLength)} bytes, max ${maxSize}).`);
		}

		// Stream body with size enforcement
		const reader = response.body?.getReader();
		if (!reader) throw new Error('No response body.');

		const chunks: Uint8Array[] = [];
		let totalBytes = 0;

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				totalBytes += value.byteLength;
				if (totalBytes > maxSize) {
					throw new Error(`Image too large (exceeded ${maxSize} bytes).`);
				}
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}

		const buffer = Buffer.concat(chunks);
		const mimeType = detectImageMime(buffer);
		if (!mimeType) {
			throw new Error('Downloaded file is not a recognized image format.');
		}

		return {
			buffer,
			mimeType,
			sizeBytes: buffer.length,
			originalUrl: url
		};
	}

	throw new Error(`Too many redirects (max ${MAX_REDIRECTS}).`);
}
