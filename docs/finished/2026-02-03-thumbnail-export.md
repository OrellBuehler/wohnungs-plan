# Thumbnail Export/Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Include project thumbnails in JSON export/import, with hybrid storage (IndexedDB for local projects, server uploads for cloud projects).

**Architecture:** Add thumbnails object store to IndexedDB, modify export to fetch and include thumbnail data, modify import to save thumbnails to IndexedDB, update thumbnail generation to check project.isLocal flag.

**Tech Stack:** TypeScript, IndexedDB (via idb library), Svelte 5

---

## Task 1: Add IndexedDB Thumbnails Store

**Files:**
- Modify: `src/lib/db/index.ts`

**Step 1: Update database schema to version 2**

Update the schema interface and database version:

```typescript
interface WohnungsPlanDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': string };
  };
  thumbnails: {
    key: string;
    value: string;  // projectId -> dataUrl
  };
}
```

Change database version from 1 to 2 and add thumbnails store in upgrade:

```typescript
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<WohnungsPlanDB>('wohnungs-plan', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' });
          store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'projectId' });
        }
      },
    });
  }
  return dbPromise;
}
```

**Step 2: Add thumbnail helper functions**

Add these functions at the end of the file:

```typescript
export async function saveThumbnail(projectId: string, dataUrl: string): Promise<void> {
  const db = await getDB();
  await db.put('thumbnails', { projectId, dataUrl });
}

export async function getThumbnail(projectId: string): Promise<string | null> {
  const db = await getDB();
  const record = await db.get('thumbnails', projectId);
  return record?.dataUrl ?? null;
}

export async function deleteThumbnail(projectId: string): Promise<void> {
  const db = await getDB();
  await db.delete('thumbnails', projectId);
}
```

**Step 3: Update deleteProject to also delete thumbnail**

Modify the deleteProject function:

```typescript
export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
  await db.delete('thumbnails', id);
}
```

**Step 4: Type-check**

Run: `bun check`

Expected: Should pass with no errors

**Step 5: Commit**

```bash
git add src/lib/db/index.ts
git commit -m "feat: add IndexedDB thumbnails store with helper functions"
```

---

## Task 2: Update Thumbnail Generation Logic

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte` (around line 298-312)

**Step 1: Import saveThumbnail function**

Add to imports at the top of the script section:

```typescript
import { saveProject as saveLocalProject, saveThumbnail } from '$lib/db';
```

**Step 2: Modify handleThumbnailReady function**

Replace the existing handleThumbnailReady function (around line 298):

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

**Step 3: Type-check**

Run: `bun check`

Expected: Should pass with no errors

**Step 4: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "feat: save thumbnails to IndexedDB for local projects"
```

---

## Task 3: Add Server Thumbnail Fetching

**Files:**
- Modify: `src/lib/utils/export.ts`

**Step 1: Add fetchServerThumbnail helper function**

Add this function after the readFileAsJSON function:

```typescript
export async function fetchServerThumbnail(projectId: string): Promise<string | null> {
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

**Step 2: Type-check**

Run: `bun check`

Expected: Should pass with no errors

**Step 3: Commit**

```bash
git add src/lib/utils/export.ts
git commit -m "feat: add helper to fetch server thumbnails as data URLs"
```

---

## Task 4: Update Export to Include Thumbnail

**Files:**
- Modify: `src/lib/utils/export.ts`

**Step 1: Modify exportProjectToJSON to accept thumbnail parameter**

Change the function signature and implementation:

```typescript
export function exportProjectToJSON(project: Project, thumbnail?: string | null): string {
  const exportData = {
    ...project,
    thumbnail: thumbnail ?? null
  };
  return JSON.stringify(exportData, null, 2);
}
```

**Step 2: Update downloadProject to use new signature**

Modify the downloadProject function:

```typescript
export function downloadProject(project: Project, thumbnail?: string | null) {
  const json = exportProjectToJSON(project, thumbnail);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

**Step 3: Type-check**

Run: `bun check`

Expected: Should pass with no errors

**Step 4: Commit**

```bash
git add src/lib/utils/export.ts
git commit -m "feat: add thumbnail parameter to export functions"
```

---

## Task 5: Update Export Handler to Fetch Thumbnail

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte` (around line 182-184)

**Step 1: Import getThumbnail and fetchServerThumbnail**

Add to imports:

```typescript
import { getThumbnail } from '$lib/db';
import { downloadProject, readFileAsJSON, importProjectFromJSON, fetchServerThumbnail } from '$lib/utils/export';
```

**Step 2: Make handleExport async and fetch thumbnail**

Replace the handleExport function:

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
  downloadProject(project, thumbnail);
}
```

**Step 3: Type-check**

Run: `bun check`

Expected: Should pass with no errors

**Step 4: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "feat: fetch and include thumbnail in JSON export"
```

---

## Task 6: Update Import to Extract and Save Thumbnail

**Files:**
- Modify: `src/lib/utils/export.ts`

**Step 1: Modify importProjectFromJSON to return thumbnail**

Change the return type and implementation:

```typescript
export function importProjectFromJSON(json: string): {
  project: Project | null;
  thumbnail: string | null;
} {
  try {
    const data = JSON.parse(json);

    // Extract thumbnail before validation
    const thumbnail = data.thumbnail ?? null;
    delete data.thumbnail;  // Remove from project data

    // Basic validation
    if (!data.id || !data.name || !Array.isArray(data.items)) {
      throw new Error('Invalid project format');
    }
    // Assign new ID to avoid conflicts
    data.id = crypto.randomUUID();
    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();
    // Add default currency if missing (backwards compatibility)
    if (!data.currency) {
      data.currency = DEFAULT_CURRENCY;
    }
    // Add default gridSize if missing (backwards compatibility)
    if (!data.gridSize) {
      data.gridSize = 50;
    }
    // Add default fields to items if missing (backwards compatibility)
    data.items = data.items.map((item: Record<string, unknown>) => ({
      ...item,
      shape: item.shape ?? 'rectangle',
      priceCurrency: item.priceCurrency ?? data.currency ?? DEFAULT_CURRENCY,
    }));

    return { project: data as Project, thumbnail };
  } catch {
    return { project: null, thumbnail: null };
  }
}
```

**Step 2: Type-check**

Run: `bun check`

Expected: Should pass with no errors

**Step 3: Commit**

```bash
git add src/lib/utils/export.ts
git commit -m "feat: extract thumbnail from imported JSON"
```

---

## Task 7: Update Import Handler to Save Thumbnail

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte` (around line 186-204)

**Step 1: Update handleImport to destructure and save thumbnail**

Replace the handleImport function:

```typescript
async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (file) {
      const json = await readFileAsJSON(file);
      const { project: imported, thumbnail } = importProjectFromJSON(json);
      if (imported) {
        setProject(imported);
        await saveLocalProject(imported);

        // Save thumbnail if present
        if (thumbnail) {
          await saveThumbnail(imported.id, thumbnail);
        }
      } else {
        alert('Invalid project file');
      }
    }
  };
  input.click();
}
```

**Step 2: Type-check**

Run: `bun check`

Expected: Should pass with no errors

**Step 3: Commit**

```bash
git add src/routes/projects/[id]/+page.svelte
git commit -m "feat: save imported thumbnails to IndexedDB"
```

---

## Final Verification

**Step 1: Full type-check**

Run: `bun check`

Expected: No errors

**Step 2: Manual testing checklist**

Test scenarios:
- [ ] Create local project, add items, verify thumbnail generates
- [ ] Export local project → JSON includes thumbnail field
- [ ] Import JSON with thumbnail → Thumbnail appears in project list
- [ ] Delete local project → Thumbnail also deleted
- [ ] Export cloud project (if available) → Thumbnail fetched from server
- [ ] Import old JSON without thumbnail → Works without errors
- [ ] Refresh browser → Local project thumbnail persists

**Step 3: Test IndexedDB upgrade**

- Open browser DevTools → Application → IndexedDB
- Verify `wohnungs-plan` database is version 2
- Verify `thumbnails` object store exists
- Export a project and check the JSON has `thumbnail` field

---

## Summary

**Files Modified:**
1. `src/lib/db/index.ts` - Added thumbnails store, version bump, helper functions
2. `src/routes/projects/[id]/+page.svelte` - Updated thumbnail generation and import/export handlers
3. `src/lib/utils/export.ts` - Added thumbnail parameter to export, updated import return type, added server fetch helper

**Key Features:**
- Hybrid storage: IndexedDB for local projects, server for cloud projects
- Backward compatible: Old JSON imports work without thumbnails
- Complete export: Thumbnails included in JSON export
- Automatic cleanup: Thumbnails deleted when projects deleted
