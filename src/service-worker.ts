/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Precache app shell (HTML, CSS, JS, fonts, icons)
precacheAndRoute(self.__WB_MANIFEST);

// Network-first for API calls (prefer fresh data, fallback to cache)
registerRoute(
	({ url }) => url.pathname.startsWith('/api/'),
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

// Listen for skip waiting
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
