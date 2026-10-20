import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CARAVAN_SOURCES, CARAVAN_DEPTH, CARAVAN_STOP_COLUMN, caravanVisitPose, scheduledCaravanVisit } from "../../src/client/game/phaser/merchantCaravan";
import { MERCHANT_TRAVEL_MS, REQUEST_OPEN_MS, REQUEST_CYCLE_MS } from "../../src/game-data/npcRequests";
import { isoPoint } from "../../src/client/game/phaser/isometricProjection";

const anchor = 100_000;
const board = { cycle: 0, closesAt: new Date(anchor + REQUEST_OPEN_MS).toISOString() };
it("loads the approved four walking poses, wheel and wheel-free idle", () => {
  expect(Object.keys(CARAVAN_SOURCES)).toHaveLength(6);
  expect(CARAVAN_SOURCES["caravan-idle"]).toContain("idle-no-wheels.png");
});
it("restores the caravan within redraw and mounts the shared request UI", () => {
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
  expect(scheduledCaravanVisit(6, board, anchor)).toEqual({ phase: "away" });
  expect(scheduledCaravanVisit(7, null, anchor)).toEqual({ phase: "away" });
  expect(scheduledCaravanVisit(7, board, anchor)).toEqual({ phase: "stopped" });
});
it("walks right along the road with four frames and distance-based wheel rotation", () => {
  const pose = (ms: number) => caravanVisitPose({ phase: "arriving", progress: ms / MERCHANT_TRAVEL_MS });
  const a = pose(0), b = pose(900), c = pose(1800);
  expect(b.x).toBeGreaterThan(a.x);
  expect(b.y - a.y).toBeCloseTo((b.x - a.x) / 2);
  expect(c.rotation).toBeCloseTo(b.rotation * 2);
  expect([0, 225, 450, 675, 900].map(t => pose(t).texture)).toEqual([
    "caravan-walk-0", "caravan-walk-1", "caravan-walk-2", "caravan-walk-3", "caravan-walk-0"]);
});
it("parks inside the left road entrance with approved road offset and foreground depth", () => {
  const p = caravanVisitPose({ phase: "stopped" });
  const point = isoPoint({ column: CARAVAN_STOP_COLUMN, row: 5 });
  expect(CARAVAN_STOP_COLUMN).toBe(-2.5);
  expect(p).toMatchObject({ x: point.x, y: point.y + 20, depth: CARAVAN_DEPTH, alpha: 1, visible: true, texture: "caravan-idle" });
  expect(CARAVAN_DEPTH).toBe(9000);
  expect(caravanVisitPose({ phase: "arriving", progress: 1 }).rotation).toBe(p.rotation);
  expect(caravanVisitPose({ phase: "departing", progress: 0 }).rotation).toBe(p.rotation);
});
it("fades at map edges, but stays visible throughout the stop", () => {
  expect(caravanVisitPose({ phase: "arriving", progress: 0 }).alpha).toBe(0);
  expect(caravanVisitPose({ phase: "arriving", progress: 1 }).alpha).toBe(1);
  expect(caravanVisitPose({ phase: "departing", progress: 0 }).alpha).toBe(1);
  expect(caravanVisitPose({ phase: "departing", progress: 1 }).alpha).toBe(0);
  expect(caravanVisitPose({ phase: "away" }).visible).toBe(false);
});
it("keeps the real schedule under reduced motion and after absence", () => {
  for (const now of [anchor - 7500, anchor, anchor + REQUEST_OPEN_MS + 7500, anchor + REQUEST_OPEN_MS * 2, anchor + REQUEST_CYCLE_MS * 8]) {
    const visit = scheduledCaravanVisit(7, board, now);
    const standard = caravanVisitPose(visit), reduced = caravanVisitPose(visit, true);
    expect(reduced).toMatchObject({ x: standard.x, y: standard.y, alpha: standard.alpha, visible: standard.visible, texture: "caravan-idle", rotation: 0 });
  }
  expect(scheduledCaravanVisit(7, board, anchor + REQUEST_CYCLE_MS * 8)).toEqual({ phase: "stopped" });
});
