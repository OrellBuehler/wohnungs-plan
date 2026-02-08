const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 20;

interface Bucket {
	count: number;
	windowStart: number;
	windowMs: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
	key: string,
	maxAttempts = DEFAULT_MAX_ATTEMPTS,
	windowMs = DEFAULT_WINDOW_MS
): boolean {
	const now = Date.now();
	const existing = buckets.get(key);

	if (!existing || now - existing.windowStart >= existing.windowMs) {
		buckets.set(key, { count: 1, windowStart: now, windowMs });
		if (buckets.size > 100) {
			for (const [k, v] of buckets) {
				if (now - v.windowStart >= v.windowMs) buckets.delete(k);
			}
		}
		return true;
	}

	if (existing.count >= maxAttempts) {
		return false;
	}

	existing.count += 1;
	return true;
}
