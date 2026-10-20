import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { isoCell, isoPoint, footprintContains, footprintFront } from "../../src/client/game/phaser/isometricProjection";
import { barleyDepth, barleyStage, buildingAt, insideWorld, presentCanals, tileInformation } from "../../src/client/game/phaser/isometricFarm";
import { previewWalkPath, previewWalkable } from "../../src/client/game/phaser/isometricWalking";
import { isometricTilePopup } from "../../src/client/game/phaser/isometricTilePopup";

const date = (ms: number) => new Date(ms).toISOString();
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });

describe("saved farm isometric projection", () => {
  it.each([[6, 1, 15], [7, 2, 20], [8, 2, 20]])("keeps granary level and capacity aligned at farm level %i", (level, granaryLevel, capacity) => {
    const saved = snapshot();
    saved.farm.progression = { level, barleySold: 0, beerSold: 0, breadSold: 0, requestsDelivered: 0,
      stats: { harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0, breadProduced: 0, processedBarley: 0 } };
    saved.buildings = [{ id, type: "granary", column: 5, row: 3, storedBarley: 7, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0, loadingTile: null, startedAt: date(0), completesAt: date(10) }];
    const restored = FarmSnapshotSchema.parse(JSON.parse(JSON.stringify(saved)));
    const popup = isometricTilePopup(restored, { column: 5, row: 3 }, 20);
    expect(popup.level).toBe(granaryLevel);
    expect(popup.details).toContain(`7 / ${capacity} barley stored`);
    expect(restored.buildings[0]!.storedBarley).toBe(7);
  });
  it("keeps ripe barley in front of a farmer stopped in it, without reversing neighbouring tiles", () => {
    const groundY = isoPoint({ column: 4, row: 7 }).y;
    expect(barleyDepth(groundY, "ripe")).toBeGreaterThan(groundY + 2);
    expect(barleyDepth(groundY, "ripe")).toBeLessThan(groundY + 24);
    expect(barleyDepth(groundY - 24, "ripe")).toBeLessThan(groundY + 1);
    expect(barleyDepth(groundY, "sown")).toBe(groundY);
    expect(barleyDepth(groundY, "growing")).toBe(groundY);
  });
  it("walks onto and through crops at every growth stage without changing them", () => {
    const saved = snapshot();
    const start = { column: 4, row: 6 }, target = { column: 4, row: 9 };
    saved.crops = [6, 7, 8, 9].map(row => ({ id, cropKey: "barley" as const,
      column: 4, row, sowingStartedAt: date(0), plantedAt: date(10),
      growthCompletesAt: date(100), harvestStartedAt: null, harvestCompletesAt: null }));
    const before = JSON.stringify(saved);
    for (const now of [10, 40, 100]) {
      expect(previewWalkable(saved, target, now)).toBe(true);
      expect(previewWalkPath(saved, start, target, now)).toEqual([
        { column: 4, row: 7 }, { column: 4, row: 8 }, target,
      ]);
      expect(isometricTilePopup(saved, target, now).actions.walk).toBe(true);
    }
    expect(JSON.stringify(saved)).toBe(before);
  });
  it("routes cardinally around the farmhouse without changing the save", () => {
    const saved = snapshot(), before = JSON.stringify(saved);
    const start = { column: 1, row: 5 }, target = { column: 1, row: 2 };
    const path = previewWalkPath(saved, start, target, 100);
    expect(path.at(-1)).toEqual(target);
    let previous = start;
    for (const cell of path) {
      expect(previewWalkable(saved, cell, 100)).toBe(true);
      expect(Math.abs(cell.column - previous.column) + Math.abs(cell.row - previous.row)).toBe(1);
      previous = cell;
    }
    expect(JSON.stringify(saved)).toBe(before);
    expect(previewWalkPath(saved, start, { column: 2, row: 3 }, 100)).toEqual([]);
    expect(previewWalkPath(saved, start, { column: 2, row: 11 }, 100)).toEqual([]);
  });
  it("blocks scenery and water, allows a completed road bridge, and rejects enclosed targets", () => {
    const saved = snapshot();
    saved.objects.push({ id, type: "rock", column: 3, row: 2 });
    saved.improvements.push({ id, type: "irrigation", column: 3, row: 6, startedAt: date(0), completesAt: date(10), destroyStartedAt: null, destroyCompletesAt: null });
    expect(previewWalkable(saved, { column: 3, row: 2 }, 100)).toBe(false);
    expect(previewWalkable(saved, { column: 3, row: 6 }, 100)).toBe(false);
    saved.farm.roads.push({ column: 3, row: 6, completesAt: 200 });
    expect(previewWalkable(saved, { column: 3, row: 6 }, 100)).toBe(false);
    expect(previewWalkable(saved, { column: 3, row: 6 }, 200)).toBe(true);
    for (const cell of [{ column: 7, row: 2 }, { column: 9, row: 2 }, { column: 8, row: 1 }, { column: 8, row: 3 }]) saved.objects.push({ id, type: "bush", ...cell });
    expect(previewWalkPath(saved, { column: 1, row: 5 }, { column: 8, row: 2 }, 200)).toEqual([]);
  });
  it("round trips every saved-world tile, including negative columns", () => {
    for (let row = 0; row <= 15; row++) for (let column = -4; column <= 11; column++) {
      const p = isoPoint({ column, row });
      expect(isoCell(p.x, p.y)).toEqual({ column, row });
      expect(insideWorld({ column, row })).toBe(true);
    }
    expect(insideWorld({ column: -5, row: 0 })).toBe(false);
  });
  it("picks within a diamond and preserves building footprints", () => {
    const origin = { column: -1, row: 3 }, p = isoPoint(origin);
    expect(isoCell(p.x + 20, p.y + 5)).toEqual(origin);
    expect(footprintContains(origin, 2, 2, { column: 0, row: 4 })).toBe(true);
    expect(footprintContains(origin, 2, 2, { column: 1, row: 4 })).toBe(false);
    expect(footprintFront(origin, 2, 2)).toEqual(isoPoint({ column: 0.5, row: 4.5 }));
  });
  it("uses the saved crop timestamps and existing stage boundaries", () => {
    const crop = { id, cropKey: "barley" as const, column: 3, row: 2, sowingStartedAt: date(0), plantedAt: date(10), growthCompletesAt: date(100), harvestStartedAt: null, harvestCompletesAt: null };
    expect(barleyStage(crop, 10)).toBe("sown");
    expect(barleyStage(crop, 40)).toBe("growing");
    expect(barleyStage(crop, 100)).toBe("ripe");
    expect(barleyStage({ ...crop, cropKey: "datePalm" }, 100)).toBeNull();
  });
  it("selects a granary from every occupied tile without modifying the snapshot", () => {
    const farm = snapshot();
    const building = { id, type: "granary" as const, column: 5, row: 3, storedBarley: 7, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0, loadingTile: null, startedAt: date(0), completesAt: date(10) };
    const saved = { ...farm, buildings: [building] }, before = JSON.stringify(saved);
    for (const column of [5, 6]) for (const row of [3, 4]) {
      expect(buildingAt(saved, { column, row })).toBe(building);
      expect(tileInformation(saved, { column, row }, 20)).toBe("Granary · 7 barley stored");
    }
    expect(JSON.stringify(saved)).toBe(before);
  });
  it("omits destroyed canals at their deadline", () => {
    const saved = { ...snapshot(), improvements: [{ id, type: "irrigation" as const, column: 3, row: 9, startedAt: date(0), completesAt: date(10), destroyStartedAt: date(20), destroyCompletesAt: date(30) }] };
    expect(presentCanals(saved, 29)).toHaveLength(1);
    expect(presentCanals(saved, 30)).toHaveLength(0);
  });
});
