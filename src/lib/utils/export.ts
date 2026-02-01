import type { Project } from '$lib/types';

export function exportProjectToJSON(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function downloadProject(project: Project) {
  const json = exportProjectToJSON(project);
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

export function importProjectFromJSON(json: string): Project | null {
  try {
    const data = JSON.parse(json);
    // Basic validation
    if (!data.id || !data.name || !Array.isArray(data.items)) {
      throw new Error('Invalid project format');
    }
    // Assign new ID to avoid conflicts
    data.id = crypto.randomUUID();
    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();
    return data as Project;
  } catch {
    return null;
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
