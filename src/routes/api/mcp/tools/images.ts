import { randomUUID } from 'crypto';
import { unlink } from 'node:fs/promises';
import { z } from 'zod';
import { getItemById, insertHistoryEntries } from '$lib/server/items';
import {
	getItemImages,
	createItemImage,
	saveItemImageFile,
	generateThumbnail,
	deleteItemImage,
	getItemImagePath,
	getItemImageThumbPath
} from '$lib/server/item-images';
import { EXT_BY_MIME } from '$lib/server/image-utils';
import { downloadImageFromUrl } from '$lib/server/url-download';
import { checkRateLimit } from '$lib/server/rate-limit';
import type { McpServer, ToolHelpers } from '../types';

export function registerImageTools(server: McpServer, helpers: ToolHelpers): void {
	const { getUserId, ensureProjectRole, checkToolEnabled, ensureBranch, asText } = helpers;

	server.registerTool(
		'add_item_image_from_url',
		{
			description:
				'Download an image from an HTTPS URL and attach it to a furniture item. Useful for adding product photos. The image is downloaded server-side with security protections (HTTPS only, no private IPs, max 5MB).',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				item_id: z.string().uuid(),
				image_url: z.string().url()
			}
		},
		async ({ project_id, branch_id, item_id, image_url }) => {
			await checkToolEnabled('add_item_image_from_url', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const item = await getItemById(project_id, branch_id, item_id);
			if (!item) {
				throw new Error('Item not found in this branch.');
			}

			const userId = getUserId();
			if (!checkRateLimit(`mcp-download:${userId}`)) {
				throw new Error('Rate limit exceeded. Max 5 image downloads per 15 minutes.');
			}

			const result = await downloadImageFromUrl(image_url);

			const ext = EXT_BY_MIME[result.mimeType];
			const filename = `${randomUUID()}.${ext}`;

			await saveItemImageFile(project_id, item_id, filename, result.buffer);
			await generateThumbnail(project_id, item_id, filename);

			let originalName = 'image.' + ext;
			try {
				const urlPath = new URL(image_url).pathname;
				const lastSegment = urlPath.split('/').pop();
				if (lastSegment && lastSegment.includes('.')) {
					originalName = decodeURIComponent(lastSegment);
				}
			} catch {
				// keep default
			}

			let image;
			try {
				image = await createItemImage(project_id, item_id, {
					filename,
					originalName,
					mimeType: result.mimeType,
					sizeBytes: result.sizeBytes
				});
			} catch (err) {
				await unlink(getItemImagePath(project_id, item_id, filename)).catch(() => {});
				await unlink(getItemImageThumbPath(project_id, item_id, filename)).catch(() => {});
				throw err;
			}

			await insertHistoryEntries([
				{
					projectId: project_id,
					branchId: branch_id,
					itemId: item_id,
					userId,
					action: 'update',
					field: 'image',
					oldValue: null,
					newValue: originalName,
					viaMcp: true
				}
			]);

			return asText({
				id: image.id,
				item_id: item_id,
				filename: image.originalName,
				mime_type: image.mimeType,
				size_bytes: image.sizeBytes,
				url: `/api/projects/${project_id}/branches/${branch_id}/items/${item_id}/images/${image.id}`,
				thumb_url: `/api/projects/${project_id}/branches/${branch_id}/items/${item_id}/images/${image.id}/thumbnail`
			});
		}
	);

	server.registerTool(
		'list_item_images',
		{
			description: 'List all images attached to a furniture item.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				item_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id, item_id }) => {
			await checkToolEnabled('list_item_images', project_id);
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const item = await getItemById(project_id, branch_id, item_id);
			if (!item) {
				throw new Error('Item not found in this branch.');
			}

			const images = await getItemImages(item_id);
			return asText(
				images.map((img) => ({
					id: img.id,
					filename: img.originalName,
					mime_type: img.mimeType,
					size_bytes: img.sizeBytes,
					sort_order: img.sortOrder,
					url: `/api/projects/${project_id}/branches/${branch_id}/items/${item_id}/images/${img.id}`,
					thumb_url: `/api/projects/${project_id}/branches/${branch_id}/items/${item_id}/images/${img.id}/thumbnail`,
					created_at: img.createdAt?.toISOString()
				}))
			);
		}
	);

	server.registerTool(
		'delete_item_image',
		{
			description: 'Delete an image from a furniture item.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				item_id: z.string().uuid(),
				image_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id, item_id, image_id }) => {
			await checkToolEnabled('delete_item_image', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const item = await getItemById(project_id, branch_id, item_id);
			if (!item) {
				throw new Error('Item not found in this branch.');
			}

			const images = await getItemImages(item_id);
			const image = images.find((img) => img.id === image_id);
			if (!image) {
				throw new Error('Image not found for this item.');
			}

			const deleted = await deleteItemImage(project_id, item_id, image_id);
			if (!deleted) {
				throw new Error('Image not found for this item.');
			}

			const userId = getUserId();
			await insertHistoryEntries([
				{
					projectId: project_id,
					branchId: branch_id,
					itemId: item_id,
					userId,
					action: 'update',
					field: 'image',
					oldValue: image.originalName ?? image.filename,
					newValue: null,
					viaMcp: true
				}
			]);

			return asText({ success: true, image_id });
		}
	);
}
