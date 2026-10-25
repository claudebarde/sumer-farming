import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DATE_PALM_SOURCES, isometricCropSprite } from "../../src/client/game/phaser/isometricDatePalm";
import { farmRenderKey } from "../../src/client/game/phaser/farmRenderState";
import { FarmSnapshotSchema } from "../../src/schemas/farm";

const hour = 3600000;
const iso = (n: number) => new Date(n * hour).toISOString();
const id = "00000000-0000-4000-8000-000000000001";
const crop = { id, cropKey: "datePalm" as const, column: 4, row: 8,
  sowingStartedAt: iso(-1), plantedAt: iso(0), growthCompletesAt: iso(24),
  harvestStartedAt: null, harvestCompletesAt: null };

describe("isometric palm stages", () => {
  it("uses the trunk-base anchor for planted palms and the preview tree", () => {
    const source = readFileSync(new URL("../../src/client/game/phaser/scenes/IsometricFarmScene.ts", import.meta.url), "utf8");
    expect(source).toContain('this.add.image(p.x, p.y, sprite).setOrigin(DATE_PALM_ORIGIN.x, DATE_PALM_ORIGIN.y).setDisplaySize(100, 100)');
    expect(source).toMatch(/this\.datePreviewTree = this\.add\.image\(p\.x, p\.y, "datePalmReady"\)\s*\.setOrigin\(DATE_PALM_ORIGIN\.x, DATE_PALM_ORIGIN\.y\)/);
  });
  it("loads all four new sprites", () => {
    expect(Object.values(DATE_PALM_SOURCES)).toHaveLength(4);
    for (const url of Object.values(DATE_PALM_SOURCES)) expect(url).toContain("isometric-test/date-palms/date-palm-isometric-");
  });
  it.each([
    [-1, null], [0, "datePalmSapling"], [11.999, "datePalmSapling"],
    [12, "datePalmGrowing"], [17.999, "datePalmGrowing"],
    [18, "datePalmFlowering"], [23.999, "datePalmFlowering"],
    [24, "datePalmReady"], [100, "datePalmReady"]
  ])("shows initial growth at hour %s", (time, sprite) => {
    expect(isometricCropSprite(crop, time * hour)).toBe(sprite);
  });
  it("uses saved regrowth progress and doubles only the progress after tending", () => {
    const cycle = { startedAt: 30 * hour, originalReadyAt: 54 * hour };
    const regrowing = { ...crop, growthCompletesAt: iso(54) };
    expect(isometricCropSprite(regrowing, 41.999 * hour, cycle)).toBe("datePalmGrowing");
    expect(isometricCropSprite(regrowing, 42 * hour, cycle)).toBe("datePalmFlowering");
    const tended = { ...cycle, tendedAt: 36 * hour };
    const accelerated = { ...regrowing, growthCompletesAt: iso(45) };
    expect(isometricCropSprite(accelerated, 36 * hour, tended)).toBe("datePalmGrowing");
    expect(isometricCropSprite(accelerated, 38.999 * hour, tended)).toBe("datePalmGrowing");
    expect(isometricCropSprite(accelerated, 39 * hour, tended)).toBe("datePalmFlowering");
    expect(isometricCropSprite(accelerated, 45 * hour, tended)).toBe("datePalmReady");
  });
  it("preserves legacy deadlines and removes fruit when harvesting finishes", () => {
    const legacy = { ...crop, growthCompletesAt: iso(36) };
    expect(isometricCropSprite(legacy, 29 * hour)).toBe("datePalmGrowing");
    expect(isometricCropSprite(legacy, 30 * hour)).toBe("datePalmFlowering");
    expect(isometricCropSprite(legacy, 36 * hour)).toBe("datePalmReady");
    expect(isometricCropSprite({ ...crop, harvestStartedAt: iso(25), harvestCompletesAt: iso(26) }, 26 * hour)).toBe("datePalmGrowing");
  });
  it("redraws at visual boundaries and catches up without replaying earlier stages", () => {
    const s = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
      farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
        household: { happiness: 70, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
      inventory: [], objects: [], groundItems: [], crops: [crop], improvements: [], buildings: [] });
    expect(farmRenderKey(s, 1 * hour)).toBe(farmRenderKey(s, 11 * hour));
    expect(farmRenderKey(s, 12 * hour)).not.toBe(farmRenderKey(s, 11 * hour));
    expect(farmRenderKey(s, 18 * hour)).not.toBe(farmRenderKey(s, 17 * hour));
    expect(farmRenderKey(s, 24 * hour)).not.toBe(farmRenderKey(s, 23 * hour));
    expect(farmRenderKey(s, 24 * hour)).toBe(farmRenderKey(s, 100 * hour));
  });
});
