import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { farmerBuildTexture, FARMER_BUILD_SOURCES } from "../../src/client/game/phaser/farmerBuild";
import { activeConstruction, isometricConstructionPose, constructionApproachPath, savedRoadApproach } from "../../src/client/game/phaser/isometricConstruction";
import { pickupPose } from "../../src/client/game/phaser/isometricPickup";
import { previewWalkable } from "../../src/client/game/phaser/isometricWalking";

const id = "00000000-0000-4000-8000-000000000001";
const date = (n: number) => new Date(n).toISOString();
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });

describe("construction work presentation", () => {
  it.each([false, true])("walks before road work and resumes saved travel (removing=%s)", removing => {
    const s = snapshot();
    const path = [{ column: 3, row: 5 }, { column: 4, row: 5 }, { column: 5, row: 5 }];
    s.farm.roads = [{ column: 5, row: 4, removing, approachPath: path, completesAt: 6360 }];
    const approach = savedRoadApproach(s, 1090)!;
    expect(approach.startedAt).toBe(1000);
    expect(pickupPose(approach.path, approach.startedAt, 1090)).toMatchObject({ walking: true, position: { column: 3.5, row: 5 } });
    expect(savedRoadApproach(s, 1270)).toEqual(approach);
    expect(pickupPose(approach.path, approach.startedAt, 1360).walking).toBe(false);
    expect(activeConstruction(s, 1360)?.startedAt).toBe(1360);
    expect(isometricConstructionPose(s, 1360)?.position).toEqual(path.at(-1));
    expect(savedRoadApproach(s, 6360)).toBeNull();
  });
  it("keeps blocked road removal selectable for an explanatory toast", async () => {
    const { isometricTilePopup } = await import("../../src/client/game/phaser/isometricTilePopup");
    const s = snapshot();
    s.farm.roads = [{ column: 5, row: 4 }, { column: 5, row: 3 }];
    expect(isometricTilePopup(s, s.farm.roads[0]!, 1000).actions.destroyRoad).toBe(true);
    expect(isometricTilePopup(s, { column: 5, row: 5 }, 1000).actions.destroyRoad).toBe(false);
    s.farm.roads[0] = { column: 5, row: 4, removing: true, completesAt: 6000, approachPath: [{ column: 5, row: 5 }] };
    expect(isometricTilePopup(s, s.farm.roads[0], 1000).actions.destroyRoad).toBe(false);
    expect(isometricConstructionPose(s, 2000)?.position).toEqual({ column: 5, row: 5 });
    expect(activeConstruction(s, 6000)).toBeNull();
  });
  it("resumes canal demolition with the same work pose and stops at its saved deadline", () => {
    const s = snapshot();
    s.improvements = [{ id, type: "irrigation", column: 3, row: 9, startedAt: date(0), completesAt: date(1), destroyStartedAt: date(1000), destroyCompletesAt: date(6000) }];
    expect(activeConstruction(s, 4000)).toMatchObject({ startedAt: 1000, completesAt: 6000 });
    expect(isometricConstructionPose(s, 4000)?.elapsed).toBe(3000);
    expect(isometricConstructionPose(s, 6000)).toBeNull();
  });
  it.each(["granary", "mill", "breadOven", "brewery"])("resumes %s work at its loading tile and never replays completed construction", type => {
    const s = snapshot();
    const deadline = type === "breadOven" || type === "brewery" ? 181000 : 121000;
    s.buildings = FarmSnapshotSchema.parse({ ...s, buildings: [{ id, type, column: 4, row: 3,
      storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
      loadingTile: { column: 4, row: 5 }, startedAt: date(1000), completesAt: date(deadline) }] }).buildings;
    expect(isometricConstructionPose(s, 5000)?.position).toEqual({ column: 4, row: 5 });
    expect(isometricConstructionPose(s, deadline - 1)).not.toBeNull();
    expect(isometricConstructionPose(s, deadline)).toBeNull();
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
