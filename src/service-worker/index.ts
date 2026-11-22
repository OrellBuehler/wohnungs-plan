import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

// Precache app shell (CSS, JS, fonts, icons). Manifest paths are relative to the site root.
// Immutable files are content-hashed, everything else is revisioned by the app version.
precacheAndRoute([
	...immutable.map(({ path }) => ({ url: `/${path}`, revision: null })),
	...[...assets, ...prerendered]
		.filter(({ path }) => !path.split('/').some((segment) => segment.startsWith('.')))
		.map(({ path }) => ({ url: `/${path}`, revision: version }))
]);

// Network-first for API calls (prefer fresh data, fallback to cache).
// Image endpoints are excluded so they are handled by the image cache below.
registerRoute(
	({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/images/'),
	new NetworkFirst({
		cacheName: 'api-cache',
		plugins: [
			new ExpirationPlugin({
				maxEntries: 50,
				maxAgeSeconds: 5 * 60 // 5 minutes
			})
		]
	})
);

// Cache-first for images (use cache, update in background)
registerRoute(
	({ request }) => request.destination === 'image',
	new CacheFirst({
		cacheName: 'image-cache',
		plugins: [
			new ExpirationPlugin({
				maxEntries: 100,
				maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
			})
		]
	})
);

// Activate a new worker immediately and take over open pages
self.skipWaiting();

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

// Listen for skip waiting
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
