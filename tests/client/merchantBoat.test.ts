import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boatRippleInRiver, merchantBoatRipples } from "../../src/client/game/phaser/merchantBoat";
import { isoPoint } from "../../src/client/game/phaser/isometricProjection";
import { INITIAL_FARM_CONFIG as config } from "../../src/game-data/initialFarm";
import { MERCHANT_BOAT_CELL, MERCHANT_BOAT_SIZE, MERCHANT_BOAT_SOURCE, MERCHANT_BOAT_ORIGIN, merchantBoatBob, merchantPoleAngle, merchantBoatTravel } from "../../src/client/game/phaser/merchantBoat";
import { scheduledMerchantVisit } from "../../src/client/game/phaser/merchantVisit";
import { MERCHANT_TRAVEL_MS, REQUEST_OPEN_MS, REQUEST_CYCLE_MS } from "../../src/game-data/npcRequests";

it("connects the boat renderer to the saved request schedule, not the preview clock", () => {
  const scene = readFileSync(new URL("../../src/client/game/phaser/scenes/IsometricFarmScene.ts", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../../src/client/game/phaser/merchantBoat.ts", import.meta.url), "utf8");
  expect(scene).toContain("scheduledMerchantVisit(this.snapshot.farm.progression?.level ?? 1, board, Date.now() + clockOffset)");
  expect(scene).toContain("createMerchantBoat(this)");
  expect(scene).not.toContain('from "../merchantCaravan"');
  expect(renderer).toContain("const travel = merchantBoatTravel(visit)");
  expect(renderer).not.toContain("BOAT_PREVIEW_LOOP_MS");
  expect(renderer).toContain("reducedMotion || !travel.moving");
});

it("uses the new reed boat on the river row closest to the fields", () => {
  expect(MERCHANT_BOAT_SOURCE).toContain("merchant-reed-boat-idle-no-pole.webp");
  expect(MERCHANT_BOAT_CELL.row).toBe(config.riverRow);
  expect(MERCHANT_BOAT_CELL.column).toBeGreaterThan(config.plotBounds.maximumColumn + 2);
  expect(MERCHANT_BOAT_CELL.column).toBeLessThan(config.worldBounds.maximumColumn);
  expect(MERCHANT_BOAT_SIZE).toBe(205);
  expect(MERCHANT_BOAT_ORIGIN).toEqual({ x: 0.53, y: 0.59 });
});

it("emits a subtle bounded wake only during travel and fades it after stopping", () => {
  const ripples = merchantBoatRipples({ phase: "arriving", progress: 0.8 });
  expect(ripples.length).toBeGreaterThan(0);
  expect(ripples.length).toBeLessThanOrEqual(12);
  for (const ripple of ripples) {
    expect(ripple.alpha).toBeGreaterThanOrEqual(0);
    expect(ripple.alpha).toBeLessThanOrEqual(0.35);
    expect(ripple.points).toHaveLength(17);
  }
  expect(Math.max(...ripples.map(ripple => ripple.alpha))).toBeGreaterThan(0.3);
  expect(merchantBoatRipples({ phase: "arriving", progress: 1.01 }).length).toBeGreaterThan(0);
  expect(merchantBoatRipples({ phase: "arriving", progress: 1.1 })).toEqual([]);
  expect(merchantBoatRipples({ phase: "stopped" })).toEqual([]);
  expect(merchantBoatRipples({ phase: "away" })).toEqual([]);
  expect(merchantBoatRipples({ phase: "departing", progress: 0.5 }).length).toBeGreaterThan(0);
  expect(merchantBoatRipples({ phase: "arriving", progress: 0.8 }, true)).toEqual([]);
  expect(merchantBoatRipples({ phase: "arriving", progress: 0 })).toEqual([]);
});

it("clips wake strokes to the river instead of the fields or off-map water", () => {
  const point = (column: number, row: number) => isoPoint({ column, row });
  expect(boatRippleInRiver(point(5, config.riverRow))).toBe(true);
  expect(boatRippleInRiver(point(5, config.riverRow + 1))).toBe(true);
  expect(boatRippleInRiver(point(5, config.riverRow - 1))).toBe(false);
  expect(boatRippleInRiver(point(5, config.riverRow + 2))).toBe(false);
  expect(boatRippleInRiver(point(config.worldBounds.minimumColumn - 1, config.riverRow))).toBe(false);
  expect(boatRippleInRiver(point(config.worldBounds.maximumColumn + 1, config.riverRow))).toBe(false);
});

it("uses the chariot schedule on the approved river route without a test loop", () => {
  const anchor = 100_000;
  const board = { cycle: 0, closesAt: new Date(anchor + REQUEST_OPEN_MS).toISOString() };
  const pose = (now: number) => merchantBoatTravel(scheduledMerchantVisit(7, board, now));
  expect(pose(anchor - MERCHANT_TRAVEL_MS - 1).visible).toBe(false);
  expect(pose(anchor - MERCHANT_TRAVEL_MS).alpha).toBe(0);
  const midway = pose(anchor - MERCHANT_TRAVEL_MS / 2);
  const stopped = pose(anchor);
  expect(midway.x).toBeLessThan(stopped.x);
  expect(stopped).toMatchObject({ ...isoPoint(MERCHANT_BOAT_CELL), moving: false, alpha: 1, visible: true });
  expect(pose(anchor + REQUEST_OPEN_MS - 1)).toEqual(stopped);
  expect(pose(anchor + REQUEST_OPEN_MS)).toMatchObject({ x: stopped.x, y: stopped.y, moving: true });
  expect(pose(anchor + REQUEST_OPEN_MS + MERCHANT_TRAVEL_MS / 2).x).toBeGreaterThan(stopped.x);
  expect(pose(anchor + REQUEST_OPEN_MS + MERCHANT_TRAVEL_MS).visible).toBe(false);
  expect(merchantBoatTravel({ phase: "departing", progress: 1 }).alpha).toBe(0);
  expect(pose(anchor + REQUEST_CYCLE_MS * 8)).toEqual(stopped);
  expect(pose(anchor + REQUEST_CYCLE_MS * 8 + REQUEST_OPEN_MS * 2).visible).toBe(false);
  expect(scheduledMerchantVisit(6, board, anchor)).toEqual({ phase: "away" });
  expect(scheduledMerchantVisit(7, null, anchor)).toEqual({ phase: "away" });
});

it("rocks the separate pole gently around its grip and holds still for reduced motion", () => {
  expect(merchantPoleAngle(0)).toBe(5.3);
  expect(merchantPoleAngle(900)).toBeCloseTo(8.3);
  expect(merchantPoleAngle(2700)).toBeCloseTo(2.3);
  expect(merchantPoleAngle(3600)).toBeCloseTo(5.3);
  expect(merchantPoleAngle(900, true)).toBe(5.3);
});

it("bobs gently around the approved position in a continuous 4.8-second loop", () => {
  expect(merchantBoatBob(0)).toEqual({ y: 0, angle: 0 });
  expect(merchantBoatBob(1200)).toEqual({ y: 1.5, angle: 0.6 });
  expect(merchantBoatBob(3600)).toEqual({ y: -1.5, angle: -0.6 });
  expect(merchantBoatBob(4800).y).toBeCloseTo(0);
  expect(merchantBoatBob(4800).angle).toBeCloseTo(0);
  for (const elapsed of [0, 1200, 3600, 100000]) expect(merchantBoatBob(elapsed, true)).toEqual({ y: 0, angle: 0 });
});

const anchor = 100_000;
const board = { cycle: 0, closesAt: new Date(anchor + REQUEST_OPEN_MS).toISOString() };
it("restores the merchant boat within redraw and mounts the shared request UI", () => {
  const source = readFileSync(new URL("../../src/client/game/phaser/scenes/IsometricFarmScene.ts", import.meta.url), "utf8");
  const draw = source.slice(source.indexOf("  private draw() {"), source.indexOf("  /** Called only after a successful claim"));
  expect(draw.indexOf("this.updateMerchantCaravan()")).toBeGreaterThan(draw.indexOf("this.children.removeAll(true)"));
  const shell = readFileSync(new URL("../../src/client/components/IsometricFarm.tsx", import.meta.url), "utf8");
  expect(shell).toContain('>= 7 && <MerchantRequests visual />');
  expect(shell).not.toContain("Preview merchant animation");
  expect(source).toContain('visit.phase === "stopped"');
  expect(source).toContain("merchantUiStore.getState().setOpen(true)");
});
it("keeps the level gate and never invents a schedule", () => {
  expect(scheduledMerchantVisit(6, board, anchor)).toEqual({ phase: "away" });
  expect(scheduledMerchantVisit(7, null, anchor)).toEqual({ phase: "away" });
  expect(scheduledMerchantVisit(7, board, anchor)).toEqual({ phase: "stopped" });
});

it("lets transparent boat padding pass through and samples transformed artwork pixels", async () => {
  const { merchantPartHit } = await import("../../src/client/game/phaser/merchantBoat");
  // A translated, rotated, scaled part, as when the boat bobs or the pole swings.
  const angle = Math.PI / 6, scale = 0.4, origin = { x: 271, y: 302 };
  const world = (x: number, y: number) => ({
    x: 500 + scale * ((x - origin.x) * Math.cos(angle) - (y - origin.y) * Math.sin(angle)),
    y: 300 + scale * ((x - origin.x) * Math.sin(angle) + (y - origin.y) * Math.cos(angle)),
  });
  const image = {
    visible: true, alpha: 1, displayOriginX: origin.x, displayOriginY: origin.y,
    texture: { key: "merchant-boat" }, frame: { name: "__BASE" },
    getWorldTransformMatrix: () => ({ applyInverse: (x: number, y: number) => ({
      x: ((x - 500) * Math.cos(angle) + (y - 300) * Math.sin(angle)) / scale,
      y: (-(x - 500) * Math.sin(angle) + (y - 300) * Math.cos(angle)) / scale,
    }) }),
    scene: { textures: { getPixelAlpha: (x: number, y: number) =>
      x < 0 || y < 0 || x >= 512 || y >= 512 ? null : x >= 200 && y >= 300 ? 255 : 0 } },
  } as unknown as import("phaser").GameObjects.Image;
  const hit = (x: number, y: number) => { const p = world(x, y); return merchantPartHit(image, p.x, p.y); };
  expect(hit(250.5, 350.5)).toBe(true);
  expect(hit(250.5, 100.5)).toBe(false); // Transparent upper padding over the palm.
  expect(hit(-10, 350)).toBe(false);
  image.visible = false;
  expect(hit(250.5, 350.5)).toBe(false);
  image.visible = true; image.alpha = 0;
  expect(hit(250.5, 350.5)).toBe(false);
});
