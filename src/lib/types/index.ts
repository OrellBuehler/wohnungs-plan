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
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  floorplan: Floorplan | null;
  items: Item[];
  currency: CurrencyCode;
  gridSize: number;          // Grid size in pixels
  isLocal?: boolean;         // true if stored only in IndexedDB
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // New fields for overview page
  isLocal: boolean;              // true if only in IndexedDB
  floorplanUrl: string | null;   // thumbnail URL or null
  memberCount: number;           // 0 for local, 1+ for shared cloud projects
}
