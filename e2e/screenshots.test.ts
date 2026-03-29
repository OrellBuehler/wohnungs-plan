import { test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const SCREENSHOT_DIR = join(import.meta.dirname, 'screenshots');

test.beforeAll(async () => {
	await mkdir(SCREENSHOT_DIR, { recursive: true });
});

async function seedProject(page: import('@playwright/test').Page) {
	return await page.evaluate(() => {
		return new Promise<string>((resolve, reject) => {
			const projectId = crypto.randomUUID();
			const branchId = crypto.randomUUID();
			const now = new Date().toISOString();

			const project = {
				id: projectId,
				name: 'New Project',
				createdAt: now,
				updatedAt: now,
				floorplan: null,
				items: [],
				branches: [
					{
						id: branchId,
						projectId,
						name: 'Main',
						forkedFromId: null,
						createdBy: 'local',
						createdAt: now
					}
				],
				activeBranchId: branchId,
				currency: 'CHF',
				gridSize: 50,
				isLocal: true
			};

			const request = indexedDB.open('wohnungs-plan', 2);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains('projects')) {
					const store = db.createObjectStore('projects', { keyPath: 'id' });
					store.createIndex('by-updated', 'updatedAt');
				}
				if (!db.objectStoreNames.contains('thumbnails')) {
					db.createObjectStore('thumbnails', { keyPath: 'projectId' });
				}
			};
			request.onsuccess = () => {
				const db = request.result;
				const tx = db.transaction('projects', 'readwrite');
				tx.objectStore('projects').put(project);
				tx.oncomplete = () => resolve(projectId);
				tx.onerror = () => reject(tx.error);
			};
			request.onerror = () => reject(request.error);
		});
	});
}

test('home — empty state', async ({ page }) => {
	await page.goto('/');
	await page.waitForFunction(
		() => !document.querySelector('.animate-pulse'),
		{ timeout: 10_000 }
	);
	await page.screenshot({
		path: join(SCREENSHOT_DIR, 'home-empty.png'),
		fullPage: true
	});
});

test('home — with project', async ({ page }) => {
	await page.goto('/');
	await seedProject(page);
	await page.reload();
	await page.waitForFunction(
		() => !document.querySelector('.animate-pulse'),
		{ timeout: 10_000 }
	);
	await page.screenshot({
		path: join(SCREENSHOT_DIR, 'home-with-project.png'),
		fullPage: true
	});
});
