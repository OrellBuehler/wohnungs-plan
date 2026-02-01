export interface Position {
  x: number;
  y: number;
}

export interface Floorplan {
  imageData: string;        // Base64 encoded image
  scale: number;            // Pixels per centimeter
  referenceLength: number;  // Real-world cm used to calibrate
}

export interface Item {
  id: string;
  name: string;
  width: number;            // Centimeters
  height: number;           // Centimeters
  color: string;            // Hex color
  price: number | null;
  productUrl: string | null;
  position: Position | null; // Null if not placed
  rotation: number;         // Degrees
}

import type { CurrencyCode } from '$lib/utils/currency';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  floorplan: Floorplan | null;
  items: Item[];
  currency: CurrencyCode;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
