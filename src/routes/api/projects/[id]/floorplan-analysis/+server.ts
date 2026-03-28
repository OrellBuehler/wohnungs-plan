import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getProjectRole } from '$lib/server/projects';
import { getFloorplanAnalysis } from '$lib/server/floorplan-analyses';

/**
 * GET /api/projects/[id]/floorplan-analysis
 *
 * Returns AI-extracted floorplan analysis data (walls, doors, windows, rooms).
 * Used by the canvas to render architectural elements as a visual layer.
 *
 * Returns lighter payload than full item list - only architectural data.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const projectId = params.id;

	// Verify user has access to this project
	const role = await getProjectRole(projectId, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied. You do not have permission to view this project.');
	}

	// Fetch analysis data from database
	const analysis = await getFloorplanAnalysis(projectId);

	if (!analysis) {
		return json({
			exists: false,
			data: null,
			message:
				'No floorplan analysis available. Use the MCP save_floorplan_analysis tool to create one.'
		});
	}

	// Return structured data for canvas rendering
	return json({
		exists: true,
		data: {
			walls: analysis.walls || [],
			doors: analysis.openings?.filter((o) => o.type === 'door') || [],
			windows: analysis.openings?.filter((o) => o.type === 'window') || [],
			rooms: analysis.rooms || [],
			scale: analysis.scale || null,
			metadata: analysis.metadata || {}
		},
		summary: {
			walls_count: analysis.walls?.length || 0,
			doors_count: analysis.openings?.filter((o) => o.type === 'door').length || 0,
			windows_count: analysis.openings?.filter((o) => o.type === 'window').length || 0,
			rooms_count: analysis.rooms?.length || 0,
			has_scale: !!analysis.scale
		}
	});
};
