import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("phaser", () => ({ default: {} }));
vi.mock("../../src/client/game/phaser/buildingProgressBar", () => ({ drawBuildingProgress: vi.fn() }));
import type Phaser from "phaser";
import { bakingPose, bakingWisps, BAKING_CYCLE_MS, BAKING_WORKER_TEXTURE_OPTIONS, createBakingAnimation, bakingTableTexture } from "../../src/client/game/phaser/breadOvenAnimation";
import { bakingProgress, bakingJourneyPose } from "../../src/client/game/phaser/isometricBaking";
import { roadsideOutputPlacement, isometricOutputPosition } from "../../src/client/game/phaser/buildingOutputPlacement";
const job = { startedAt: new Date(1000).toISOString(), completesAt: new Date(301000).toISOString(), output: 2 };

it("resolves active oven artwork before sampling its shadow after scene redraw", () => {
  const source = readFileSync(new URL("../../src/client/game/phaser/scenes/IsometricFarmScene.ts", import.meta.url), "utf8");
  const appearance = source.indexOf("oven.animation.render(");
  const shadow = source.indexOf("this.daylightShadows.render(");
  expect(appearance).toBeGreaterThan(-1);
  expect(shadow).toBeGreaterThan(appearance);
});

it("ties dough counts to batch progress, not the paddle cycle", () => {
  for (const [elapsed, texture] of [[0, "baking-5"], [99999, "baking-5"], [100000, "baking-6"], [199999, "baking-6"], [200000, "baking-7"], [299999, "baking-7"]] as const) {
    expect(bakingTableTexture(bakingProgress(job, elapsed + 1000)!.fraction)).toBe(texture);
  }
  expect(bakingProgress(job, 301000)).toBeNull();
  expect(bakingProgress(job, 999)).toBeNull();
  expect(bakingProgress(job, 3600000)).toBeNull();
  expect(bakingTableTexture(2)).toBe("baking-7");
  expect(bakingTableTexture(1 / 3)).toBe("baking-6");
  expect(bakingTableTexture(2 / 3)).toBe("baking-7");
});

it("chooses C for the road behind the oven even when its saved loading tile touches A", () => {
  const placement = roadsideOutputPlacement({ column: 2, row: 6, loadingTile: { column: 2, row: 5 } }, [], 1000);
  expect(placement).toEqual({ tile: { column: 3, row: 6 }, pickup: { column: 3, row: 5 } });
  expect(isometricOutputPosition(placement.tile)).toEqual({ x: -144, y: 232 });
  expect(roadsideOutputPlacement({ column: 2, row: 3 }, [], 1000)).toEqual({ tile: { column: 2, row: 4 }, pickup: { column: 2, row: 5 } });
});

it("breaks equal-road ties using valid saved access, then B, independently of road order", () => {
  const roads = [6, 7, 8].map(row => ({ column: 4, row })).concat([{ column: 3, row: 8 }, { column: 2, row: 8 }]);
  const oven = { column: 2, row: 6 };
  expect(roadsideOutputPlacement(oven, roads, 1000).tile).toEqual({ column: 2, row: 7 });
  const saved = { ...oven, loadingTile: { column: 3, row: 5 } };
  expect(roadsideOutputPlacement(saved, roads, 1000).tile).toEqual({ column: 3, row: 6 });
  expect(roadsideOutputPlacement(saved, [...roads].reverse(), 1000)).toEqual(roadsideOutputPlacement(saved, roads, 1000));
});

it("ignores unfinished/disconnected roads and falls back to B without a pickup road", () => {
  const oven = { column: 2, row: 1, loadingTile: { column: 4, row: 1 } };
  const branch = [1, 2, 3, 4].map(row => ({ column: 4, row }));
  expect(roadsideOutputPlacement(oven, branch, 1000)).toEqual({ tile: { column: 3, row: 1 }, pickup: { column: 4, row: 1 } });
  const disconnected = branch.filter(r => r.row !== 3);
  const fallback = { tile: { column: 2, row: 2 }, pickup: null };
  expect(roadsideOutputPlacement(oven, disconnected, 1000)).toEqual(fallback);
  expect(roadsideOutputPlacement(oven, branch.map(r => r.row === 3 ? { ...r, completesAt: 2000 } : r), 1000)).toEqual(fallback);
});

it("reconciles supply travel on reload and carries flour only after visiting home", () => {
  const saved = { ...job, preparation: { departedAt: 0, stepDurationMs: 180, path: [{ column: 0, row: 0 }, { column: 1, row: 0 }, { column: 2, row: 0 }], supplyIndex: 1 } };
  expect(bakingJourneyPose(saved, 90)).toMatchObject({ carrying: false, position: { column: 0.5, row: 0 } });
  expect(bakingJourneyPose(saved, 270)).toMatchObject({ carrying: true, position: { column: 1.5, row: 0 } });
  expect(bakingJourneyPose(saved, 1000)).toBeNull();
});

it("prepares the worker at twice its display width with gentle sharpening", () => {
  expect(BAKING_WORKER_TEXTURE_OPTIONS).toEqual({ maxSize: 140, sharpen: 0.15 });
  expect(bakingWisps(2100)[0]!.alpha).toBeCloseTo(0.42);
});

it("pushes and pulls twice then rests, with a seamless repeat", () => {
  expect(Array.from({ length: 6 }, (_, i) => bakingPose(i * 250).frame)).toEqual([1, 2, 3, 2, 4, 1]);
  expect(bakingPose(1500).frame).toBe(1);
  for (const t of [3000, 4000, 5199]) expect(bakingPose(t).frame).toBe(1);
  expect(bakingPose(BAKING_CYCLE_MS)).toMatchObject({ frame: 1 });
  expect(bakingPose(750, true)).toMatchObject({ frame: 1, glow: 0.25 });
});

it("keeps smoke sparse and light with invisible recycling", () => {
  expect(bakingWisps(0)).toHaveLength(3);
  expect(bakingWisps(4200)).toEqual(bakingWisps(0));
  for (let t = 0; t < 4200; t += 100) for (const w of bakingWisps(t)) {
    expect(w.alpha).toBeGreaterThanOrEqual(0);
    expect(w.alpha).toBeLessThanOrEqual(0.42);
    expect(w.y).toBeLessThanOrEqual(0);
  }
});

it("restores idle artwork at completion and cleans up objects and mask", () => {
  const mask = { destroy: vi.fn() };
  const sprite = () => ({ x: 0, y: 0, depth: 0, ...Object.fromEntries(
    ["setTexture", "setOrigin", "setPosition", "setDisplaySize", "setDepth", "setVisible", "setMask", "clearMask", "clear", "fillStyle", "fillRect", "fillRoundedRect", "fillEllipse", "destroy"].map(k => [k, vi.fn().mockReturnThis()])),
    createGeometryMask: () => mask });
  const images: ReturnType<typeof sprite>[] = [];
  const make = () => { const s = sprite(); images.push(s); return s; };
  const addImage = vi.fn(make);
  const scene = { add: { image: addImage, graphics: make }, make: { graphics: make } } as unknown as Phaser.Scene;
  const oven = sprite();
  const preview = createBakingAnimation(scene, oven as unknown as Phaser.GameObjects.Image);
  expect(preview.shadowAnchor().visible).toBe(false);
  preview.render(job, 1000, false);
  expect(preview.shadowAnchor()).toEqual({ x: -44, y: -21, visible: true });
  expect(oven.setTexture).toHaveBeenLastCalledWith("baking-0");
  expect(images[0]!.setPosition).toHaveBeenLastCalledWith(-66, -81);
  expect(images[1]!.setTexture).toHaveBeenLastCalledWith("baking-5");
  preview.render(job, 101000, false);
  expect(images[1]!.setTexture).toHaveBeenLastCalledWith("baking-6");
  preview.render(job, 201000, true);
  expect(preview.shadowAnchor()).toEqual({ x: -44, y: -21, visible: true });
  expect(images[1]!.setTexture).toHaveBeenLastCalledWith("baking-7");
  expect(images[1]!.setPosition).toHaveBeenLastCalledWith(22, 9);
  preview.render(job, 301000, false);
  expect(preview.shadowAnchor().visible).toBe(false);
  expect(oven.setTexture).toHaveBeenLastCalledWith("breadOven");
  expect(images[0]!.setVisible).toHaveBeenLastCalledWith(false);
  expect(images[1]!.setVisible).toHaveBeenLastCalledWith(false);
  preview.destroy();
  expect(preview.shadowAnchor().visible).toBe(false);
  expect(mask.destroy).toHaveBeenCalledOnce();
  for (const image of images) expect(image.destroy).toHaveBeenCalledOnce();
});
