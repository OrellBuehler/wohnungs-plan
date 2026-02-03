import type { Project } from '$lib/types';
import { DEFAULT_CURRENCY } from '$lib/utils/currency';

export function exportProjectToJSON(project: Project, thumbnail?: string | null): string {
  const exportData = {
    ...project,
    thumbnail: thumbnail ?? null
  };
  return JSON.stringify(exportData, null, 2);
}

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

export async function readFileAsJSON(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function fetchServerThumbnail(projectId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/images/thumbnails/${projectId}.png`);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function fetchServerFloorplan(imagePath: string): Promise<string | null> {
  try {
    const response = await fetch(imagePath);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
