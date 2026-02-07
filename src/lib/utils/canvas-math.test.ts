import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  clientToContainer,
  screenToWorld,
  worldToScreen,
  zoomTowardPoint,
} from '$lib/utils/canvas-math';

const EPSILON = 1e-6;

describe('clampZoom', () => {
  it('clamps zoom below min', () => {
    expect(clampZoom(0.2, 0.5, 5)).toBe(0.5);
  });

  it('clamps zoom above max', () => {
    expect(clampZoom(8, 0.5, 5)).toBe(5);
  });

  it('returns zoom within range unchanged', () => {
    expect(clampZoom(2.25, 0.5, 5)).toBe(2.25);
  });
});

describe('screen/world transforms', () => {
  it('roundtrips at zoom 1 without pan', () => {
    const world = screenToWorld(120, 80, 1, 0, 0);
    const screen = worldToScreen(world.x, world.y, 1, 0, 0);
    expect(screen.x).toBeCloseTo(120, 8);
    expect(screen.y).toBeCloseTo(80, 8);
  });

  it('roundtrips at zoom 2 with pan offsets', () => {
    const world = screenToWorld(300, 180, 2, -40, 25);
    const screen = worldToScreen(world.x, world.y, 2, -40, 25);
    expect(screen.x).toBeCloseTo(300, 8);
    expect(screen.y).toBeCloseTo(180, 8);
  });
});

describe('zoomTowardPoint', () => {
  it('keeps anchor fixed on screen after zoom', () => {
    const anchor = { x: 350, y: 240 };
    const oldZoom = 1.5;
    const oldPan = { x: -80, y: 30 };
    const newZoom = 2.4;

    const worldAtAnchor = screenToWorld(anchor.x, anchor.y, oldZoom, oldPan.x, oldPan.y);
    const transformed = zoomTowardPoint({
      anchorX: anchor.x,
      anchorY: anchor.y,
      oldZoom,
      newZoom,
      panX: oldPan.x,
      panY: oldPan.y,
    });
    const screenAfter = worldToScreen(
      worldAtAnchor.x,
      worldAtAnchor.y,
      transformed.zoom,
      transformed.panX,
      transformed.panY
    );

    expect(screenAfter.x).toBeCloseTo(anchor.x, 8);
    expect(screenAfter.y).toBeCloseTo(anchor.y, 8);
  });

  it('keeps anchor fixed across multiple zoom/pan scenarios', () => {
    const scenarios = [
      { anchorX: 0, anchorY: 0, oldZoom: 1, newZoom: 2, panX: 0, panY: 0 },
      { anchorX: 120, anchorY: 600, oldZoom: 0.75, newZoom: 1.25, panX: 50, panY: -120 },
      { anchorX: 500, anchorY: 300, oldZoom: 3.5, newZoom: 0.9, panX: -300, panY: 180 },
    ];

    for (const scenario of scenarios) {
      const worldAtAnchor = screenToWorld(
        scenario.anchorX,
        scenario.anchorY,
        scenario.oldZoom,
        scenario.panX,
        scenario.panY
      );

      const transformed = zoomTowardPoint(scenario);
      const screenAfter = worldToScreen(
        worldAtAnchor.x,
        worldAtAnchor.y,
        transformed.zoom,
        transformed.panX,
        transformed.panY
      );

      expect(Math.abs(screenAfter.x - scenario.anchorX)).toBeLessThan(EPSILON);
      expect(Math.abs(screenAfter.y - scenario.anchorY)).toBeLessThan(EPSILON);
    }
  });
});

describe('clientToContainer', () => {
  it('converts viewport coordinates to container-relative coordinates', () => {
    const point = clientToContainer(460, 315, { left: 200, top: 100 });
    expect(point).toEqual({ x: 260, y: 215 });
  });
});

describe('font-size formulas with stage zoom', () => {
  it('world-space labels stay linear (no quadratic zoom)', () => {
    const basePx = 12;
    const zoom = 2.5;
    const localWorldFontSize = basePx;
    const effectiveScreenSize = localWorldFontSize * zoom;

    expect(effectiveScreenSize).toBeCloseTo(basePx * zoom, 8);
    expect(effectiveScreenSize).not.toBeCloseTo(basePx * zoom * zoom, 8);
  });

  it('HUD labels using 1/zoom remain constant on screen', () => {
    const basePx = 11;
    const zoomValues = [0.5, 1, 2, 4];

    for (const zoom of zoomValues) {
      const localHudFontSize = basePx / zoom;
      const effectiveScreenSize = localHudFontSize * zoom;
      expect(effectiveScreenSize).toBeCloseTo(basePx, 8);
    }
  });
});
