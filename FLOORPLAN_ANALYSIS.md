# Floorplan Analysis - User-Driven AI Approach

## 🎯 Architecture Overview

**Zero Cost to Service Provider** - Users' AI agents do the analysis work using their own Claude/GPT subscriptions.

```
┌─────────────────────────────────────────────────────────────┐
│                     User's AI Agent                          │
│                  (Claude, GPT-4, etc.)                       │
└─────────────────────────────────────────────────────────────┘
          │                              │
          │ 1. Get Image                 │ 3. Save Analysis
          ▼                              ▼
┌──────────────────┐              ┌──────────────────┐
│ get_project_     │              │ save_floorplan_  │
│ preview          │              │ analysis         │
│ (MCP Tool)       │              │ (MCP Tool)       │
└──────────────────┘              └──────────────────┘
          │                              │
          │ Returns PNG                  │ Stores JSON
          ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Database                               │
│  • Floorplan images (PNGs)                                  │
│  • Structured analysis (JSONB): rooms, walls, doors         │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Workflow

### 1. User Initiates Analysis
User's AI agent calls:
```typescript
// Step 1: Get the floorplan image
get_project_preview({ project_id: "abc-123" })
// Returns: base64 PNG image
```

### 2. User's AI Analyzes (Using Their Own Vision API)
The AI agent uses its own vision capabilities (Claude Vision, GPT-4 Vision, etc.):
- Detects rooms and boundaries
- Identifies walls (start/end points)
- Finds doors and windows
- Estimates scale if visible

**Cost:** Paid by the user through their AI subscription ✅

### 3. AI Saves Structured Data
```typescript
save_floorplan_analysis({
  project_id: "abc-123",
  analysis: {
    rooms: [
      {
        id: "room1",
        type: "bedroom",
        polygon: [[100, 100], [400, 100], [400, 300], [100, 300]],
        area_sqm: 15.5,
        dimensions: { width: 4.0, height: 3.5 },
        label: "Master Bedroom"
      }
    ],
    walls: [
      {
        id: "wall1",
        start: [100, 100],
        end: [400, 100],
        thickness: 0.2
      }
    ],
    openings: [
      {
        id: "door1",
        type: "door",
        position: [250, 100],
        width: 0.9,
        wall_id: "wall1"
      }
    ],
    scale: {
      pixels_per_meter: 50,
      reference_length: 5.0,
      unit: "meters"
    },
    metadata: {
      confidence: 0.85,
      analyzed_with: "claude-sonnet-4-5",
      notes: "Clear floorplan with measurements visible"
    }
  }
})
```

### 4. Future Queries Use Cached Data
```typescript
// Retrieve saved analysis
get_floorplan_analysis({ project_id: "abc-123" })
// Returns: Complete structured data (no API call needed!)
```

## 📐 Data Schema

### FloorplanAnalysisData Type

```typescript
type FloorplanAnalysisData = {
  rooms: {
    id: string;
    type: string; // "bedroom" | "living_room" | "kitchen" | "bathroom" | "hallway" | "other"
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
    type: "door" | "window";
    position: [number, number];
    width?: number;
    wall_id?: string;
  }[];

  scale?: {
    pixels_per_meter: number;
    reference_length?: number;
    unit?: string; // "meters" | "feet" | "cm"
  };

  metadata?: {
    confidence?: number; // 0.0 - 1.0
    notes?: string;
    analyzed_with?: string; // e.g., "claude-sonnet-4-5", "gpt-4-vision"
    [key: string]: unknown;
  };
};
```

## 🎨 Use Cases

### 1. Intelligent Furniture Placement
```typescript
// AI can now:
const analysis = await get_floorplan_analysis();

// ✅ Avoid placing furniture through walls
const isValidPosition = !intersectsWall(itemPos, analysis.walls);

// ✅ Keep doorways clear
const blocksDoor = analysis.openings.some(opening =>
  opening.type === 'door' && overlaps(itemPos, opening)
);

// ✅ Suggest room-appropriate furniture
if (room.type === 'bedroom') {
  suggestFurniture(['bed', 'nightstand', 'dresser']);
}
```

### 2. Space Optimization
```typescript
// Calculate usable space
const usableArea = room.area_sqm - doorClearance - windowArea;
const canFit = furnitureArea <= usableArea * 0.6; // 60% rule
```

### 3. Visual Validation
```typescript
// Check if furniture placement makes sense
const inCorrectRoom = isPointInPolygon(item.position, room.polygon);
const respectsScale = item.width * scale.pixels_per_meter < room.dimensions.width;
```

## 💡 Benefits

### For Service Provider (You):
- ✅ **Zero API costs** - Users pay for their own AI usage
- ✅ **No model hosting** - No infrastructure to maintain
- ✅ **Scalable** - Works with any AI that has vision capabilities
- ✅ **Future-proof** - Users can use latest/best AI models

### For Users:
- ✅ **Free service** - No extra charges beyond their AI subscription
- ✅ **Privacy** - Analysis happens in their AI session
- ✅ **Quality control** - Can verify and correct AI output
- ✅ **Flexibility** - Can use any AI vision model they prefer

## 🔧 MCP Tools Reference

### `get_project_preview`
**Purpose:** Get floorplan image for analysis
**Returns:** Base64-encoded PNG image
**Parameters:**
- `project_id` (string, UUID)

### `save_floorplan_analysis`
**Purpose:** Store AI-extracted structured data
**Returns:** Success confirmation with summary
**Parameters:**
- `project_id` (string, UUID)
- `analysis` (FloorplanAnalysisData object)

### `get_floorplan_analysis`
**Purpose:** Retrieve cached analysis
**Returns:** Structured floorplan data or null
**Parameters:**
- `project_id` (string, UUID)

## 🚀 Example AI Agent Workflow

```typescript
async function analyzeAndPlanFurniture(projectId: string) {
  // 1. Check if analysis already exists
  const existing = await mcp.call('get_floorplan_analysis', { project_id: projectId });

  if (!existing.success) {
    // 2. Get floorplan image
    const preview = await mcp.call('get_project_preview', { project_id: projectId });

    // 3. Analyze with vision (using user's AI)
    const analysis = await analyzeImageWithVision(preview.image);

    // 4. Save for future use
    await mcp.call('save_floorplan_analysis', {
      project_id: projectId,
      analysis: analysis
    });
  }

  // 5. Use analysis for furniture planning
  const data = await mcp.call('get_floorplan_analysis', { project_id: projectId });

  // Now AI can make informed suggestions:
  // - Don't place furniture through walls
  // - Keep doorways clear
  // - Respect room dimensions
  // - Suggest appropriate furniture for room types
}
```

## 🎓 Alternative Approaches (Not Implemented)

For reference, here are other approaches we researched but didn't implement:

### Computer Vision Models (High Accuracy, High Complexity)
- **CubiCasa5k**: Pre-trained on 5,000 floorplans, 90%+ accuracy
- **YOLOv8**: Real-time object detection for architectural elements
- **U-Net**: Semantic segmentation for room boundaries
- **Cost:** Free after Python inference service setup
- **Why not?** Requires hosting, deployment, maintenance

### Paid Vision APIs (Easy, Recurring Cost)
- **Claude Vision API**: $0.50-1.00 per image
- **GPT-4 Vision API**: Similar pricing
- **Why not?** Recurring costs for service provider

### Current Approach (User-Driven)
- **Cost:** $0 for service provider ✅
- **Accuracy:** Depends on user's AI (typically 70-80%)
- **Setup:** Simple MCP tools
- **Maintenance:** Minimal

## 📊 Database

New table: `floorplan_analyses`
```sql
CREATE TABLE floorplan_analyses (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  analyzed_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_floorplan_analyses_unique_project ON floorplan_analyses(project_id);
```

## 🔮 Future Enhancements

1. **Manual Editing UI**: Let users correct AI mistakes in browser
2. **3D Visualization**: Use analysis to generate 3D models
3. **Export Formats**: CAD, SVG, DXF export from structured data
4. **Validation Rules**: Automatic checks for impossible layouts
5. **Version History**: Track analysis changes over time
