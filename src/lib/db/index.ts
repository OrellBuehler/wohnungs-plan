import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, ProjectMeta } from '$lib/types';
import { DEFAULT_CURRENCY } from '$lib/utils/currency';

interface WohnungsPlanDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': string };
  };
}

let dbPromise: Promise<IDBPDatabase<WohnungsPlanDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<WohnungsPlanDB>('wohnungs-plan', 1, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

export async function getAllProjects(): Promise<ProjectMeta[]> {
  const db = await getDB();
  const projects = await db.getAllFromIndex('projects', 'by-updated');
  return projects.reverse().map(({ id, name, createdAt, updatedAt }) => ({
    id,
    name,
    createdAt,
    updatedAt,
  }));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  // Deep clone to strip Svelte 5 proxy objects (IndexedDB can't clone proxies)
  const plainProject = JSON.parse(JSON.stringify(project)) as Project;
  plainProject.updatedAt = new Date().toISOString();
  await db.put('projects', plainProject);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

export function createNewProject(name: string = 'Untitled Project'): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    floorplan: null,
    items: [],
    currency: DEFAULT_CURRENCY,
  };
}
