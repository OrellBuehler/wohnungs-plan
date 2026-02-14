export interface Position {
  x: number;
  y: number;
}

export interface Floorplan {
  imageData: string;        // Base64 encoded image
  scale: number;            // Pixels per centimeter
  referenceLength: number;  // Real-world cm used to calibrate
}

export type ItemShape = 'rectangle' | 'l-shape';
export type CutoutCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

import type { CurrencyCode } from '$lib/utils/currency';

export interface ItemImage {
  id: string;
  filename: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  url: string;       // full-size image URL (API URL or data URL)
  thumbUrl: string;  // thumbnail URL
}

export interface Item {
  id: string;
  name: string;
  width: number;            // Centimeters (outer bounds)
  height: number;           // Centimeters (outer bounds)
  color: string;            // Hex color
  price: number | null;
  priceCurrency: CurrencyCode; // Currency for this item's price
  productUrl: string | null;
  position: Position | null; // Null if not placed
  rotation: number;         // Degrees
  shape: ItemShape;
  // L-shape specific (optional)
  cutoutWidth?: number;     // Width of cutout in cm
  cutoutHeight?: number;    // Height of cutout in cm
  cutoutCorner?: CutoutCorner; // Which corner is cut out
  // Item images (gallery)
  images?: ItemImage[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  floorplan: Floorplan | null;
  items: Item[];
  branches?: ProjectBranch[];
  activeBranchId?: string | null;
  defaultBranchId?: string | null;
  currency: CurrencyCode;
  gridSize: number;          // Grid size in pixels
  isLocal?: boolean;         // true if stored only in IndexedDB
}

export interface ProjectBranch {
  id: string;
  projectId: string;
  name: string;
  forkedFromId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ItemChange {
  id: string;
  projectId: string;
  branchId: string;
  itemId: string;
  userId: string | null;
  action: 'create' | 'update' | 'delete';
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  viaMcp: boolean;
  createdAt: string;
  userName?: string | null;
  userAvatarUrl?: string | null;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // New fields for overview page
  isLocal: boolean;              // true if only in IndexedDB
  thumbnailUrl: string | null;   // generated canvas thumbnail URL or null
  floorplanUrl: string | null;   // floorplan image URL fallback or null
  memberCount: number;           // 0 for local, 1+ for shared cloud projects
}
