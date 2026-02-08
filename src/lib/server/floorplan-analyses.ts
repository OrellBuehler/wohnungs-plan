import { eq } from 'drizzle-orm';
import {
	getDB,
	floorplanAnalyses,
	type FloorplanAnalysis,
	type NewFloorplanAnalysis
} from './db';

/**
 * Structured floorplan analysis data format
 */
export type FloorplanAnalysisData = {
	rooms: {
		id: string;
		type: string; // bedroom, living_room, kitchen, bathroom, hallway, other
		polygon: [number, number][]; // Room boundary coordinates
		area_sqm?: number;
		dimensions?: { width: number; height: number };
		label?: string;
	}[];
	walls: {
		id: string;
		start: [number, number];
		end: [number, number];
		thickness?: number;
	}[];
	openings: {
		id: string;
		type: 'door' | 'window';
		position: [number, number];
		width?: number;
		wall_id?: string;
	}[];
	scale?: {
		pixels_per_meter: number;
		reference_length?: number;
		unit?: string;
	};
	metadata?: {
		confidence?: number;
		notes?: string;
		analyzed_with?: string; // e.g., "claude-sonnet-4-5", "gpt-4-vision"
		[key: string]: unknown;
	};
};

/**
 * Save or update floorplan analysis for a project.
 * Uses atomic upsert via ON CONFLICT to avoid race conditions.
 */
export async function saveFloorplanAnalysis(
	projectId: string,
	userId: string,
	data: FloorplanAnalysisData
): Promise<FloorplanAnalysis> {
	const db = getDB();

	const [analysis] = await db
		.insert(floorplanAnalyses)
		.values({
			projectId,
			analyzedBy: userId,
			data: data as unknown as Record<string, unknown>
		})
		.onConflictDoUpdate({
			target: floorplanAnalyses.projectId,
			set: {
				data: data as unknown as Record<string, unknown>,
				analyzedBy: userId,
				updatedAt: new Date()
			}
		})
		.returning();

	return analysis;
}

/**
 * Get floorplan analysis for a project
 */
export async function getFloorplanAnalysis(
	projectId: string
): Promise<FloorplanAnalysisData | null> {
	const db = getDB();

	const [analysis] = await db
		.select()
		.from(floorplanAnalyses)
		.where(eq(floorplanAnalyses.projectId, projectId));

	if (!analysis) {
		return null;
	}

	return analysis.data as unknown as FloorplanAnalysisData;
}

/**
 * Delete floorplan analysis for a project
 */
export async function deleteFloorplanAnalysis(projectId: string): Promise<boolean> {
	const db = getDB();

	const result = await db
		.delete(floorplanAnalyses)
		.where(eq(floorplanAnalyses.projectId, projectId))
		.returning();

	return result.length > 0;
}
