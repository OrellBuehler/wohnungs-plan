# Thumbnail Export/Import Design

Include project thumbnails in JSON export/import for complete backup capability.

## Problem

Currently, thumbnails are not included in JSON exports:
- Server projects: thumbnails stored in `uploads/thumbnails/{projectId}.png`
- Local projects: no persistent thumbnail storage
- Export: only exports project data, not thumbnail
- Import: loses thumbnail data

## Solution: Hybrid Storage Architecture

### Storage Strategy

**Server Projects** (project.isLocal === false):
- Thumbnails remain in `uploads/thumbnails/` folder
- No changes to current server upload behavior

**Local Projects** (project.isLocal === true):
- Thumbnails stored in IndexedDB `thumbnails` object store
- Persists across browser sessions

**Export** (all projects):
- Fetch thumbnail from IndexedDB OR server
- Include as base64 data URL in exported JSON

**Import** (creates local project):
- Extract thumbnail from JSON if present
- Save to IndexedDB thumbnails store

### IndexedDB Schema

Add new object store to existing database:

```typescript
{
  stores: {
    projects: { keyPath: 'id' },     // Existing
    thumbnails: {                     // New
      keyPath: 'projectId',
      value: 'dataUrl'                // Base64 PNG data URL
    }
  }
}
```

## Implementation

### 1. IndexedDB Functions

**File:** `src/lib/db/index.ts`

Add to database schema:
```typescript
const db = await openDB<MyDB>('wohnungs-plan', 2, {  // Increment version
  upgrade(db) {
    if (!db.objectStoreNames.contains('projects')) {
      db.createObjectStore('projects', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('thumbnails')) {
      db.createObjectStore('thumbnails', { keyPath: 'projectId' });
    }
  }
});
```

Add new functions:
```typescript
export async function saveThumbnail(projectId: string, dataUrl: string): Promise<void>
export async function getThumbnail(projectId: string): Promise<string | null>
export async function deleteThumbnail(projectId: string): Promise<void>
```

### 2. Thumbnail Generation

**File:** `src/routes/projects/[id]/+page.svelte`

Modify `handleThumbnailReady()`:
```typescript
async function handleThumbnailReady(dataUrl: string) {
  if (!project) return;
  try {
    if (project.isLocal) {
      // Save to IndexedDB for local projects
      await saveThumbnail(project.id, dataUrl);
    } else {
      // Upload to server for cloud projects
      await fetch('/api/thumbnails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          imageData: dataUrl
        })
      });
    }
  } catch (error) {
    console.error('Failed to save thumbnail:', error);
  }
}
```

### 3. Export Logic

**File:** `src/lib/utils/export.ts`

Add helper to fetch server thumbnails:
```typescript
async function fetchServerThumbnail(projectId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/images/thumbnails/${projectId}.png`);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
```

Modify export function:
```typescript
export async function exportProjectToJSON(
  project: Project,
  thumbnail?: string | null
): Promise<string> {
  const exportData = {
    ...project,
    thumbnail: thumbnail ?? null
  };
  return JSON.stringify(exportData, null, 2);
}
```

Modify import function:
```typescript
export function importProjectFromJSON(json: string): {
  project: Project | null;
  thumbnail: string | null;
} {
  try {
    const data = JSON.parse(json);

    // Extract thumbnail before processing
    const thumbnail = data.thumbnail ?? null;
    delete data.thumbnail;  // Remove from project data

    // Existing validation and processing...

    return { project: data as Project, thumbnail };
  } catch {
    return { project: null, thumbnail: null };
  }
}
```

### 4. Export Handler

**File:** `src/routes/projects/[id]/+page.svelte`

Update export handler:
```typescript
async function handleExport() {
  if (!project) return;

  // Fetch thumbnail based on project type
  let thumbnail: string | null = null;
  if (project.isLocal) {
    thumbnail = await getThumbnail(project.id);
  } else {
    thumbnail = await fetchServerThumbnail(project.id);
  }

  // Export with thumbnail
  const json = await exportProjectToJSON(project, thumbnail);
  downloadProjectJSON(json, project.name);
}
```

### 5. Import Handler

**File:** `src/routes/projects/[id]/+page.svelte` (or wherever import is handled)

Update import handler:
```typescript
async function handleImport(file: File) {
  const json = await readFileAsJSON(file);
  const { project, thumbnail } = importProjectFromJSON(json);

  if (!project) {
    // Show error
    return;
  }

  // Save project to IndexedDB
  await saveProject(project);

  // Save thumbnail if present
  if (thumbnail) {
    await saveThumbnail(project.id, thumbnail);
  }

  // Navigate to imported project
  goto(`/projects/${project.id}`);
}
```

## Backward Compatibility

**Exporting old projects:**
- Projects without thumbnails export with `thumbnail: null`
- No errors, still creates valid JSON

**Importing old JSON:**
- JSON without `thumbnail` field → `thumbnail: null`
- Import proceeds normally, no thumbnail saved
- No errors thrown

**Existing cloud projects:**
- Continue using server uploads folder
- No migration needed

## Testing Scenarios

- [ ] Export local project with thumbnail → JSON includes base64 thumbnail
- [ ] Export cloud project with thumbnail → JSON includes fetched thumbnail
- [ ] Export project without thumbnail → JSON has `thumbnail: null`
- [ ] Import JSON with thumbnail → Thumbnail saved to IndexedDB
- [ ] Import old JSON without thumbnail → Import succeeds, no thumbnail
- [ ] Local project thumbnail persists across browser refresh
- [ ] Cloud project thumbnail still uploads to server

## Files Modified

1. `src/lib/db/index.ts` - Add thumbnails store and helper functions
2. `src/lib/utils/export.ts` - Add thumbnail to export/import
3. `src/routes/projects/[id]/+page.svelte` - Update handlers for thumbnails
