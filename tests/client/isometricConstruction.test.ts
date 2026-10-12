import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { farmerBuildTexture, FARMER_BUILD_SOURCES } from "../../src/client/game/phaser/farmerBuild";
import { activeConstruction, isometricConstructionPose, constructionApproachPath } from "../../src/client/game/phaser/isometricConstruction";
import { pickupPose } from "../../src/client/game/phaser/isometricPickup";
import { previewWalkable } from "../../src/client/game/phaser/isometricWalking";

const id = "00000000-0000-4000-8000-000000000001";
const date = (n: number) => new Date(n).toISOString();
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });

describe("construction work presentation", () => {
  it("resumes granary work at its loading tile and never replays completed construction", () => {
    const s = snapshot();
    s.buildings = FarmSnapshotSchema.parse({ ...s, buildings: [{ id, type: "granary", column: 4, row: 6,
      storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
      loadingTile: { column: 4, row: 5 }, startedAt: date(1000), completesAt: date(121000) }] }).buildings;
    expect(isometricConstructionPose(s, 5000)?.position).toEqual({ column: 4, row: 5 });
    expect(isometricConstructionPose(s, 121000)).toBeNull();
    expect(isometricConstructionPose(s, 999999)).toBeNull();
  });
  it("walks to the closest reachable neighbour without crossing the excavation", () => {
    const s = snapshot(), target = { column: 3, row: 9 }, from = { column: 3, row: 5 };
    const path = constructionApproachPath(s, from, target, 1000)!;
    expect(path[0]).toEqual(from);
    expect(path.at(-1)).toEqual({ column: 3, row: 8 });
    expect(path).not.toContainEqual(target);
    expect(path.every(cell => previewWalkable(s, cell, 1000))).toBe(true);
    expect(pickupPose(path, 1000, 1539).walking).toBe(true);
    expect(pickupPose(path, 1000, 1540).walking).toBe(false);
    s.improvements = [{ id, type: "irrigation", ...target, startedAt: date(1000), completesAt: date(6000), destroyStartedAt: null, destroyCompletesAt: null }];
    expect(isometricConstructionPose(s, 1540, path.at(-1))).toMatchObject({ position: path.at(-1), offsetX: 0, offsetY: 0 });
    expect(isometricConstructionPose(s, 6000, path.at(-1))).toBeNull();
    expect(pickupPose(path, 1000, 100000)).toMatchObject({ walking: false, position: path.at(-1) });
  });
  it("stays beside a nearby site and rejects sites with no reachable work tile", () => {
    const s = snapshot(), target = { column: 3, row: 9 }, from = { column: 3, row: 8 };
    expect(constructionApproachPath(s, from, target, 1000)).toEqual([from]);
    s.objects = [{ column: 2, row: 9 }, from, { column: 4, row: 9 }].map(cell => ({ id, ...cell, type: "rock" as const }));
    expect(constructionApproachPath(s, { column: 3, row: 5 }, target, 1000)).toBeNull();
  });
  it("cycles prepare/lower/strike/lower without changing pose scale", () => {
    expect(FARMER_BUILD_SOURCES).toHaveLength(3);
    expect([0, 350, 700, 1050, 1400].map(farmerBuildTexture)).toEqual([
      "farmer-build-v2-0", "farmer-build-v2-1", "farmer-build-v2-2", "farmer-build-v2-1", "farmer-build-v2-0",
    ]);
    expect(farmerBuildTexture(-1)).toBe("farmer-build-v2-0");
  });
  it("uses the saved road deadline and stops exactly on completion", () => {
    const s = snapshot(); s.farm.roads = [{ column: 3, row: 4, completesAt: 6000 }];
    expect(activeConstruction(s, 2000)?.startedAt).toBe(1000);
    const pose = isometricConstructionPose(s, 2000)!;
    expect(pose.elapsed).toBe(1000);
    expect(previewWalkable(s, pose.position, 2000)).toBe(true);
    expect(isometricConstructionPose(s, 6000)).toBeNull();
    expect(isometricConstructionPose(s, 100000)).toBeNull();
  });
  it("resumes canal work from saved time beside the canal, not inside it", () => {
    const s = snapshot();
    s.improvements = [{ id, type: "irrigation", column: 3, row: 9, startedAt: date(1000), completesAt: date(6000), destroyStartedAt: null, destroyCompletesAt: null }];
    const pose = isometricConstructionPose(s, 4000)!;
    expect(pose.elapsed).toBe(3000);
    expect(pose.position).not.toEqual({ column: 3, row: 9 });
    expect(previewWalkable(s, pose.position, 4000)).toBe(true);
    expect(isometricConstructionPose(s, 6000)).toBeNull();
  });
  it("avoids occupied work positions", () => {
    const s = snapshot(); s.farm.roads = [{ column: 3, row: 4, completesAt: 6000 }];
    // The farm occupies the first candidate at (2,4).
    expect(isometricConstructionPose(s, 2000)?.position).toEqual({ column: 3, row: 3 });
  });
});
