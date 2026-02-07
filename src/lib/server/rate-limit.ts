const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

interface Bucket {
	count: number;
	windowStart: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string): boolean {
	const now = Date.now();
	const existing = buckets.get(key);

	if (!existing || now - existing.windowStart >= WINDOW_MS) {
		buckets.set(key, { count: 1, windowStart: now });
		return true;
	}

	if (existing.count >= MAX_ATTEMPTS) {
		return false;
	}

	existing.count += 1;
	return true;
}
