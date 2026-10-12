import { afterEach, describe, expect, it, vi } from "vitest";
import { ROAD_CONNECTIONS, roadConnectionMask } from "../../src/client/game/phaser/isometricRoads";
import { roadTextures } from "../../src/client/game/phaser/roadTextures";

afterEach(() => vi.unstubAllGlobals());
describe("automatic isometric roads", () => {
  it("selects every connection mask including rotated corners and T junctions", () => {
    const cell = { column: 3, row: 2 };
    for (let mask = 0; mask < 16; mask++) {
      const roads = ROAD_CONNECTIONS.filter(c => mask & c.bit).map(c => ({ column: cell.column + c.column, row: cell.row + c.row }));
      expect(roadConnectionMask(cell, roads, 1000)).toBe(mask);
    }
  });
  it("updates the main road only when the new branch completes", () => {
    const branch = [{ column: 3, row: 4, completesAt: 5000 }];
    expect(roadConnectionMask({ column: 3, row: 5 }, branch, 4999)).toBe(5);
    expect(roadConnectionMask({ column: 3, row: 5 }, branch, 5000)).toBe(7);
    expect(roadConnectionMask({ column: 3, row: 5 }, [...branch, { column: 3, row: 6 }], 5000)).toBe(15);
  });
  it("prepares a full 2:1 texture for all sixteen masks without changing source canvases", () => {
    const context = { drawImage: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), clip: vi.fn(), clearRect: vi.fn() };
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    const straight = { width: 256, height: 128 } as HTMLCanvasElement;
    const textures = roadTextures(straight, { ...straight }, { ...straight });
    expect(Object.keys(textures)).toHaveLength(16);
    for (const texture of Object.values(textures)) expect([texture.width, texture.height]).toEqual([256, 128]);
    expect(textures[10]).toBe(straight);
  });
});
