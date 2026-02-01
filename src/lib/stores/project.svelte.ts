import type { Project, Item, Floorplan, Position } from '$lib/types';
import type { CurrencyCode } from '$lib/utils/currency';
import { DEFAULT_CURRENCY } from '$lib/utils/currency';
import { saveProject, createNewProject } from '$lib/db';

let currentProject = $state<Project | null>(null);
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function debounceAutoSave() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  if (currentProject) {
    autoSaveTimeout = setTimeout(() => {
      if (currentProject) {
        saveProject(currentProject);
      }
    }, 1000);
  }
}

export function getProject() {
  return currentProject;
}

export function setProject(project: Project | null) {
  currentProject = project;
}

export function createProject(name?: string) {
  currentProject = createNewProject(name);
  saveProject(currentProject);
  return currentProject;
}

export function updateProjectName(name: string) {
  if (currentProject) {
    currentProject.name = name;
    debounceAutoSave();
  }
}

export function setFloorplan(floorplan: Floorplan) {
  if (currentProject) {
    currentProject.floorplan = floorplan;
    debounceAutoSave();
  }
}

export function clearFloorplan() {
  if (currentProject) {
    currentProject.floorplan = null;
    debounceAutoSave();
  }
}

export function addItem(item: Omit<Item, 'id'>) {
  if (currentProject) {
    const newItem: Item = {
      ...item,
      id: crypto.randomUUID(),
    };
    currentProject.items = [...currentProject.items, newItem];
    debounceAutoSave();
    return newItem;
  }
  return null;
}

export function updateItem(id: string, updates: Partial<Item>) {
  if (currentProject) {
    currentProject.items = currentProject.items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    debounceAutoSave();
  }
}

export function deleteItem(id: string) {
  if (currentProject) {
    currentProject.items = currentProject.items.filter((item) => item.id !== id);
    debounceAutoSave();
  }
}

export function updateItemPosition(id: string, position: Position | null) {
  updateItem(id, { position });
}

export function updateItemRotation(id: string, rotation: number) {
  updateItem(id, { rotation });
}

export function duplicateItem(id: string) {
  if (currentProject) {
    const item = currentProject.items.find((i) => i.id === id);
    if (item) {
      const newItem: Item = {
        ...item,
        id: crypto.randomUUID(),
        position: item.position
          ? { x: item.position.x + 20, y: item.position.y + 20 }
          : null,
      };
      currentProject.items = [...currentProject.items, newItem];
      debounceAutoSave();
      return newItem;
    }
  }
  return null;
}

export function getItems() {
  return currentProject?.items ?? [];
}

export function getPlacedItems() {
  return (currentProject?.items ?? []).filter((item) => item.position !== null);
}

export function getUnplacedItems() {
  return (currentProject?.items ?? []).filter((item) => item.position === null);
}

export function getTotalCost() {
  return (currentProject?.items ?? []).reduce(
    (sum, item) => sum + (item.price ?? 0),
    0
  );
}

export function getCurrency(): CurrencyCode {
  return currentProject?.currency ?? DEFAULT_CURRENCY;
}

export function setCurrency(currency: CurrencyCode) {
  if (currentProject) {
    currentProject.currency = currency;
    debounceAutoSave();
  }
}
