import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getShareAuthCookieName,
	getShareLinkByToken,
	isShareLinkValid,
	verifyShareAuthCookie
} from '$lib/server/share-links';
import {
	getProjectById,
	getProjectFloorplan,
	getProjectItems
} from '$lib/server/projects';
import {
	ensureMainBranch,
	getBranchById,
	getDefaultBranch,
	listProjectBranches
} from '$lib/server/branches';

function sanitizeItems(items: Awaited<ReturnType<typeof getProjectItems>>) {
	return items.map((item) => ({
		id: item.id,
		branchId: item.branchId,
		name: item.name,
		width: item.width,
		height: item.height,
		x: item.x,
		y: item.y,
		rotation: item.rotation,
		color: item.color,
		price: item.price,
		priceCurrency: item.priceCurrency,
		productUrl: item.productUrl,
		shape: item.shape,
		cutoutWidth: item.cutoutWidth,
		cutoutHeight: item.cutoutHeight,
		cutoutCorner: item.cutoutCorner,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt
	}));
}

export const GET: RequestHandler = async ({ params, cookies, url }) => {
	const link = await getShareLinkByToken(params.token);
	if (!link || !isShareLinkValid(link)) {
		throw error(404, 'Share link not found');
	}

	const project = await getProjectById(link.projectId);
	if (!project) {
		throw error(404, 'Project not found');
	}

	if (link.passwordHash) {
		const cookieName = getShareAuthCookieName(link.token);
		const cookieValue = cookies.get(cookieName) ?? '';
		if (!verifyShareAuthCookie(cookieValue, link.id)) {
			return json({
				requiresPassword: true,
				projectName: project.name
			});
		}
	}

	let defaultBranch = await getDefaultBranch(project.id);
	if (!defaultBranch) {
		defaultBranch = await ensureMainBranch(project.id, project.ownerId);
	}

	const requestedBranchId = url.searchParams.get('branch');
	const activeBranch = requestedBranchId
		? await getBranchById(project.id, requestedBranchId)
		: defaultBranch;
	if (!activeBranch) {
		throw error(404, 'Branch not found');
	}

	const [items, floorplan, branches] = await Promise.all([
		getProjectItems(project.id, activeBranch.id),
		getProjectFloorplan(project.id),
		listProjectBranches(project.id)
	]);

	return json({
		project: {
			name: project.name,
			currency: project.currency,
			gridSize: project.gridSize
		},
		items: sanitizeItems(items),
		floorplan: floorplan
			? {
					filename: floorplan.filename,
					originalName: floorplan.originalName,
					mimeType: floorplan.mimeType,
					sizeBytes: floorplan.sizeBytes,
					scale: floorplan.scale,
					referenceLength: floorplan.referenceLength,
					createdAt: floorplan.createdAt,
					updatedAt: floorplan.updatedAt
				}
			: null,
		branches: branches.map((branch) => ({
			id: branch.id,
			name: branch.name,
			forkedFromId: branch.forkedFromId,
			createdAt: branch.createdAt
		})),
		activeBranchId: activeBranch.id
	});
};
