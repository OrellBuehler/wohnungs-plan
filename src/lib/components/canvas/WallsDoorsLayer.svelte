<script lang="ts">
	import { Group, Line, Arc, Circle } from 'svelte-konva';
	import { getFloorplanAnalysis } from '$lib/stores/project.svelte';

	const analysis = $derived(getFloorplanAnalysis());
	const visible = $derived(analysis.visible && analysis.loaded);

	// Visual styling constants
	const WALL_COLOR = '#1e293b'; // Slate-800
	const WALL_OPACITY = 0.6;
	const WALL_STROKE_WIDTH = 3;

	const DOOR_COLOR = '#0ea5e9'; // Sky-500
	const DOOR_OPACITY = 0.7;
	const DOOR_STROKE_WIDTH = 2;
	const DOOR_HINGE_RADIUS = 3;

	const WINDOW_COLOR = '#06b6d4'; // Cyan-500
	const WINDOW_OPACITY = 0.5;
	const WINDOW_STROKE_WIDTH = 2;

	// Convert walls to Konva line format
	const wallLines = $derived(
		analysis.walls.map((wall) => ({
			id: wall.id,
			points: [...wall.start, ...wall.end],
			stroke: WALL_COLOR,
			strokeWidth: wall.thickness || WALL_STROKE_WIDTH,
			opacity: WALL_OPACITY,
			lineCap: 'round' as const,
			lineJoin: 'round' as const,
			listening: false
		}))
	);

	// Render doors as arcs (90-degree swing visualization)
	const doorArcs = $derived(
		analysis.doors.map((door) => ({
			id: door.id,
			x: door.position[0],
			y: door.position[1],
			innerRadius: 0,
			outerRadius: door.width || 30,
			angle: 90, // 90-degree swing
			stroke: DOOR_COLOR,
			strokeWidth: DOOR_STROKE_WIDTH,
			opacity: DOOR_OPACITY,
			listening: false
		}))
	);

	// Render door hinge points (where door pivots)
	const doorHinges = $derived(
		analysis.doors.map((door) => ({
			id: `${door.id}-hinge`,
			x: door.position[0],
			y: door.position[1],
			radius: DOOR_HINGE_RADIUS,
			fill: DOOR_COLOR,
			opacity: DOOR_OPACITY,
			listening: false
		}))
	);

	// Render windows as double lines (window symbol)
	const windowShapes = $derived(
		analysis.windows.map((win) => {
			const width = win.width || 20;
			const x = win.position[0];
			const y = win.position[1];

			return {
				id: win.id,
				// Two parallel lines to represent window
				line1: {
					points: [x - width / 2, y - 2, x + width / 2, y - 2],
					stroke: WINDOW_COLOR,
					strokeWidth: WINDOW_STROKE_WIDTH,
					opacity: WINDOW_OPACITY,
					listening: false
				},
				line2: {
					points: [x - width / 2, y + 2, x + width / 2, y + 2],
					stroke: WINDOW_COLOR,
					strokeWidth: WINDOW_STROKE_WIDTH,
					opacity: WINDOW_OPACITY,
					listening: false
				}
			};
		})
	);

</script>

{#if visible}
	<Group id="walls-doors-layer" listening={false}>
		<!-- Walls (render first, bottom layer) -->
		{#each wallLines as wall (wall.id)}
			<Line {...wall} />
		{/each}

		<!-- Doors (arcs + hinges) -->
		{#each doorArcs as door (door.id)}
			<Arc {...door} />
		{/each}
		{#each doorHinges as hinge (hinge.id)}
			<Circle {...hinge} />
		{/each}

		<!-- Windows (double lines) -->
		{#each windowShapes as window (window.id)}
			<Line {...window.line1} />
			<Line {...window.line2} />
		{/each}
	</Group>
{/if}
