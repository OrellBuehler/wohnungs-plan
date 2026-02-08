import Anthropic from '@anthropic-ai/sdk';
import { config } from '$lib/server/env';
import { readFile } from 'node:fs/promises';

export type FloorplanAnalysis = {
	rooms: {
		id: string;
		type: string;
		polygon: [number, number][];
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
		confidence: number;
		notes?: string;
	};
};

/**
 * Analyze a floorplan image using Claude Vision API to extract structured data
 * about rooms, walls, doors, windows, and dimensions.
 */
export async function analyzeFloorplanWithVision(
	imageBuffer: Buffer,
	mimeType: string
): Promise<FloorplanAnalysis> {
	// Check if API key exists
	const apiKey = process.env.ANTHROPIC_API_KEY || config.anthropicApiKey;
	if (!apiKey) {
		throw new Error(
			'ANTHROPIC_API_KEY not configured. Set it in environment variables to use floorplan analysis.'
		);
	}

	const anthropic = new Anthropic({ apiKey });

	const base64Image = imageBuffer.toString('base64');

	const message = await anthropic.messages.create({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: 4096,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'image',
						source: {
							type: 'base64',
							media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
							data: base64Image
						}
					},
					{
						type: 'text',
						text: `Analyze this architectural floorplan image and extract structured data.

**Instructions:**
1. Identify all rooms and their approximate boundaries as polygons (x,y coordinates)
2. Detect all walls (start/end points)
3. Find all doors and windows (positions)
4. Extract any visible measurements or scale information
5. Estimate room types (bedroom, bathroom, kitchen, living room, etc.)

**Output Format:** Return ONLY valid JSON matching this structure:
{
  "rooms": [
    {
      "id": "room1",
      "type": "bedroom|living_room|kitchen|bathroom|hallway|other",
      "polygon": [[x1, y1], [x2, y2], ...],
      "area_sqm": 15.5,
      "dimensions": { "width": 4.0, "height": 3.5 },
      "label": "Master Bedroom"
    }
  ],
  "walls": [
    {
      "id": "wall1",
      "start": [x1, y1],
      "end": [x2, y2],
      "thickness": 0.2
    }
  ],
  "openings": [
    {
      "id": "door1",
      "type": "door|window",
      "position": [x, y],
      "width": 0.9,
      "wall_id": "wall1"
    }
  ],
  "scale": {
    "pixels_per_meter": 50,
    "reference_length": 5.0,
    "unit": "meters"
  },
  "metadata": {
    "confidence": 0.85,
    "notes": "High quality plan with clear measurements"
  }
}

**Important:**
- Use pixel coordinates relative to image dimensions
- If no scale info visible, estimate based on typical room sizes
- Be conservative with confidence scores
- Include notes about any ambiguities`
					}
				]
			}
		]
	});

	// Extract JSON from response
	const textContent = message.content.find((block) => block.type === 'text');
	if (!textContent || textContent.type !== 'text') {
		throw new Error('No text response from Claude');
	}

	const text = textContent.text;

	// Try to extract JSON from markdown code blocks or raw text
	let jsonStr = text;
	const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	if (jsonMatch) {
		jsonStr = jsonMatch[1];
	}

	try {
		const analysis = JSON.parse(jsonStr) as FloorplanAnalysis;
		return analysis;
	} catch (err) {
		console.error('Failed to parse Claude response:', text);
		throw new Error(`Failed to parse floorplan analysis: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Load floorplan image and analyze it
 */
export async function analyzeFloorplanFile(
	filePath: string,
	mimeType: string
): Promise<FloorplanAnalysis> {
	const imageBuffer = await readFile(filePath);
	return analyzeFloorplanWithVision(imageBuffer, mimeType);
}
