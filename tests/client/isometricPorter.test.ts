import { describe, expect, it } from "vitest";
import { visiblePorterPosition, porterPose, porterAwaitingPickup } from "../../src/client/game/phaser/isometricPorter";
import { marketEntrance, marketOrigin } from "../../src/client/game/phaser/isometricMarket";
import { INITIAL_FARM_CONFIG } from "../../src/game-data/initialFarm";
import { PORTER_HOME, porterPath } from "../../src/game-core/farm/porter";
import { PORTER_STEP_MS, type Porter } from "../../src/game-data/porter";
import { PORTER_SOURCES, PORTER_DISPLAY_SIZE, PORTER_TEXTURE_SIZE, PORTER_SHARPEN_AMOUNT, porterFrameBounds } from "../../src/client/game/phaser/porterSprites";

const porter: Porter = { hiredAt: 100, expiresAt: 10000, checkedAt: 100, position: marketEntrance, job: null };
describe("isometric porter hiring presentation", () => {
  it("faces left while waiting at the market, including immediately after returning", () => {
    expect(porterPose(porter, 500)?.facingLeft).toBe(true);
    const returning = { ...porter, home: marketEntrance, returnTrip: {
      path: [{ column: marketEntrance.column - 1, row: marketEntrance.row }, marketEntrance],
      startedAt: 100, completesAt: 100 + PORTER_STEP_MS
    } };
    expect(porterPose(returning, 110)?.facingLeft).toBe(false);
    expect(porterPose(returning, returning.returnTrip.completesAt)?.facingLeft).toBe(true);
    expect(porterPose(JSON.parse(JSON.stringify(porter)), 500)?.facingLeft).toBe(true);
  });
  it.each(["flour", "brewersGroats", "bread", "beer"] as const)("uses the correct cargo for %s at pickup, then returns empty", itemKey => {
    const path = [{ column: 1, row: 5 }, { column: 2, row: 5 }, { column: 3, row: 5 }];
    const loaded = { ...porter, job: { buildingId: "mill", itemKey, quantity: 2, startedAt: 0, pickupAt: PORTER_STEP_MS, completesAt: 2 * PORTER_STEP_MS + 1000, path, pickupIndex: 1 } };
    expect(porterPose(loaded, 20)?.texture).toContain("porter-empty-walk");
    expect(porterAwaitingPickup(loaded, "mill", 20)).toBe(2);
    expect(porterAwaitingPickup(loaded, "mill", PORTER_STEP_MS)).toBe(0);
    const pose = porterPose(loaded, PORTER_STEP_MS + 20)!;
    expect(pose.texture).toContain(itemKey === "beer" ? "porter-jars-walk" : "porter-bags-walk");
    expect(PORTER_SOURCES).toHaveProperty(pose.texture);
    expect(porterPose(loaded, PORTER_STEP_MS + 20, true)?.texture).toContain("idle");
    const returning = { ...porter, returnTrip: { path: [...path].reverse(), startedAt: 1000, completesAt: 1000 + 2 * PORTER_STEP_MS } };
    expect(porterPose(returning, 1020)?.texture).toContain("porter-empty-walk");
    expect(porterPose(returning, 1020)?.facingLeft).toBe(true);
    expect(porterPose(returning, 2000)?.position).toEqual(path[0]);
  });
  it("shares walking frame bounds across cargo and stride", () => {
    expect(porterFrameBounds("porter-bags-walk-0")).toEqual(porterFrameBounds("porter-empty-walk-1"));
    expect(porterFrameBounds("porter-jars-idle")).toEqual(porterFrameBounds("porter-empty-idle"));
  });
  it("retains detail without sharpening outlines and matches the farmer's body height", () => {
    expect(PORTER_TEXTURE_SIZE).toBe(256);
    expect(PORTER_SHARPEN_AMOUNT).toBe(0);
    const bounds = porterFrameBounds("porter-empty-idle");
    // Idle artwork's head begins near y=210; the wooden frame begins at y=83.
    const bodyHeight = (bounds.bottom - 210) / (bounds.bottom - bounds.top + 1) * (112 / 128) * PORTER_DISPLAY_SIZE;
    expect(bodyHeight).toBeGreaterThan(55);
    expect(bodyHeight).toBeLessThan(57);
  });
  it("uses a server-reachable main-road tile beside the market", () => {
    expect(marketEntrance.row).toBe(INITIAL_FARM_CONFIG.roadRow);
    expect(marketEntrance.column).toBe(marketOrigin.column);
    expect(porterPath([], [], PORTER_HOME, marketEntrance, 100)?.at(-1)).toEqual(marketEntrance);
    expect(visiblePorterPosition(porter, 100)).toEqual(marketEntrance);
  });
  it("preserves a saved position on reload instead of respawning at the market", () => {
    const saved = { ...porter, position: { column: 2, row: INITIAL_FARM_CONFIG.roadRow } };
    expect(visiblePorterPosition(JSON.parse(JSON.stringify(saved)), 500)).toEqual(saved.position);
  });
  it("hides unhired and expired porters", () => {
    expect(visiblePorterPosition(null, 100)).toBeNull();
    expect(visiblePorterPosition(porter, 10000)).toBeNull();
  });
  it("keeps a porter visible while his final booked delivery is settling", () => {
    const job: NonNullable<Porter["job"]> = { buildingId: "mill", itemKey: "flour", quantity: 1, startedAt: 9000, pickupAt: 10000, completesAt: 12000, path: [marketEntrance], pickupIndex: 0 };
    expect(visiblePorterPosition({ ...porter, job }, 11000)).toEqual(marketEntrance);
  });
});
