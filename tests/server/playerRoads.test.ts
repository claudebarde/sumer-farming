import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { isRoadIntersection, roadKey, validateRoadPlacement, findLoadingTile } from "../../src/game-core/farm/roads";
import { findRoadPreferredPath } from "../../src/game-core/farm/roadPath";
import { getBuildingFootprint, validateBuildingPlacement } from "../../src/game-core/farm/buildings";
import { isInsideArablePlot } from "../../src/game-core/farm/cultivation";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, farmGroundItems, farmObjects, farmImprovements } from "../../src/server/db/schema";
import { buildRoad } from "../../src/server/services/buildRoad";
import { buildFarmBuilding } from "../../src/server/services/buildFarmBuilding";
import { buildIrrigation } from "../../src/server/services/buildIrrigation";
import { dropCarriedItem } from "../../src/server/services/farmItemActions";
import { assertFarmerAvailable } from "../../src/server/services/farmerAvailability";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async () => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Road test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 6,
    progressionStats: { ...INITIAL_PROGRESSION_STATS, level6Baseline: { produced: 0, sold: 0 } }
  }).returning();
  return { playerId, farmId: farm!.id, type: "build_road" as const, target: { column: 5, row: 4 }, expectedFarmVersion: 1 };
};
const finishRoads = async (farmId: string) => {
  const [farm] = await db.select().from(farms).where(eq(farms.id, farmId));
  await db.update(farms).set({ roads: farm!.roads.map(r => ({ ...r, completesAt: Date.now() - 1 })) }).where(eq(farms.id, farmId));
};

describe("player-built roads", () => {
  it("rejects farmland footprints server-side and permits southern non-arable construction", async () => {
    const input = await fixture();
    await db.insert(farmGroundItems).values([
      { farmId: input.farmId, itemKey: "reed", quantity: 2, column: 0, row: 0 },
      { farmId: input.farmId, itemKey: "clay", quantity: 3, column: 1, row: 0 }
    ]);
    for (const column of [0, 7]) {
      const rejected = await Effect.runPromise(Effect.flip(buildFarmBuilding(db, { ...input, building: "granary", target: { column, row: 6 } })));
      expect(rejected).toMatchObject({ rule: { type: "outside_building_ground" } });
    }
    expect(await db.select().from(farmGroundItems).where(eq(farmGroundItems.farmId, input.farmId))).toHaveLength(2);
    const built = await Effect.runPromise(buildFarmBuilding(db, { ...input, building: "granary", target: { column: 8, row: 6 } }));
    expect(built.buildings[0]).toMatchObject({ column: 8, row: 6, loadingTile: { column: 8, row: 5 } });
  });
  it("saves construction travel from the farmer's position before five seconds of work", async () => {
    const input = await fixture();
    const farmerPosition = { column: 0, row: 5 };
    const before = Date.now();
    const result = await Effect.runPromise(buildRoad(db, { ...input, farmerPosition }));
    const road = result.farm.roads[0]!;
    expect(road.approachPath?.[0]).toEqual(farmerPosition);
    expect(road.approachPath?.at(-1)).toEqual({ column: 5, row: 5 });
    expect(road.approachPath).not.toContainEqual(input.target);
    expect(road.completesAt).toBeGreaterThanOrEqual(before + 5 * 180 + 5000);
    const [saved] = await db.select().from(farms).where(eq(farms.id, input.farmId));
    expect(saved!.roads[0]).toEqual(road);
  });
  it("removes a road after travel and five seconds of saved work", async () => {
    const input = await fixture();
    await db.update(farms).set({ roads: [input.target] }).where(eq(farms.id, input.farmId));
    const before = Date.now();
    const result = await Effect.runPromise(buildRoad(db, { ...input, type: "destroy_road" }));
    const road = result.farm.roads[0]!;
    expect(road.removing).toBe(true);
    expect(road.completesAt).toBeGreaterThanOrEqual(before + 5000);
    expect(road.approachPath?.length).toBeGreaterThan(0);
    expect(() => assertFarmerAvailable({ roads: result.farm.roads, carriedItemKey: null, fishing: null })).toThrow();
    await finishRoads(input.farmId);
    const rebuilt = await Effect.runPromise(buildRoad(db, { ...input, expectedFarmVersion: result.farm.version }));
    expect(rebuilt.farm.roads).toHaveLength(1);
    expect(rebuilt.farm.roads[0]?.removing).toBeUndefined();
  });
  it("rejects disconnection on the server without changing roads", async () => {
    const input = await fixture();
    const roads = [input.target, { column: 5, row: 3 }];
    await db.update(farms).set({ roads }).where(eq(farms.id, input.farmId));
    const result = await Effect.runPromise(Effect.flip(buildRoad(db, { ...input, type: "destroy_road" })));
    expect(result).toMatchObject({ _tag: "RoadRuleError", message: expect.stringContaining("disconnect 1 road tile") });
    const [farm] = await db.select().from(farms).where(eq(farms.id, input.farmId));
    expect(farm!.roads).toEqual(roads);
    expect(farm!.version).toBe(1);
  });
  it.each(["rock", "bush"] as const)("clears %s when building roads and preserves nearby scenery", async type => {
    const input = await fixture();
    await db.insert(farmObjects).values([
      { farmId: input.farmId, type, ...input.target },
      { farmId: input.farmId, type, column: 6, row: 4 }
    ]);
    const result = await Effect.runPromise(buildRoad(db, input));
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0]).toMatchObject({ column: 6, row: 4 });
    expect(await db.select().from(farmObjects).where(eq(farmObjects.farmId, input.farmId))).toHaveLength(1);
  });
  it.each(["rock", "bush"] as const)("clears %s when building connected irrigation", async type => {
    const input = await fixture();
    const target = { column: -1, row: 9 };
    await db.insert(farmObjects).values({ farmId: input.farmId, type, ...target });
    await Effect.runPromise(buildIrrigation(db, { ...input, target }));
    expect(await db.select().from(farmObjects).where(eq(farmObjects.farmId, input.farmId))).toHaveLength(0);
    expect(await db.select().from(farmImprovements).where(eq(farmImprovements.farmId, input.farmId))).toHaveLength(1);
  });
  it.each(["road", "irrigation"] as const)("keeps reeds blocking %s without changing the farm", async kind => {
    const input = await fixture();
    const target = kind === "road" ? input.target : { column: -1, row: 9 };
    await db.insert(farmObjects).values({ farmId: input.farmId, type: "reeds", ...target });
    const result = kind === "road"
      ? await Effect.runPromise(Effect.flip(buildRoad(db, { ...input, target })))
      : await Effect.runPromise(Effect.flip(buildIrrigation(db, { ...input, target })));
    expect(result._tag).toBe(kind === "road" ? "RoadRuleError" : "IrrigationTileOccupiedError");
    expect(await db.select().from(farmObjects).where(eq(farmObjects.farmId, input.farmId))).toHaveLength(1);
    const [farm] = await db.select().from(farms).where(eq(farms.id, input.farmId));
    expect(farm!.version).toBe(1);
    expect(farm!.roads).toEqual([]);
    expect(await db.select().from(farmImprovements).where(eq(farmImprovements.farmId, input.farmId))).toHaveLength(0);
  });
  it("does not clear scenery when connectivity validation fails", async () => {
    const input = await fixture();
    const target = { column: -1, row: 1 };
    await db.insert(farmObjects).values({ farmId: input.farmId, type: "rock", ...target });
    await Effect.runPromise(Effect.flip(buildRoad(db, { ...input, target })));
    await Effect.runPromise(Effect.flip(buildIrrigation(db, { ...input, target })));
    expect(await db.select().from(farmObjects).where(eq(farmObjects.farmId, input.farmId))).toHaveLength(1);
  });
  it("detects T junctions and crossroads, but not straight roads or diagonal branches", () => {
    const target = { column: 5, row: 5 };
    expect(isRoadIntersection(target, [])).toBe(false);
    expect(isRoadIntersection(target, [{ column: 6, row: 4 }])).toBe(false);
    expect(isRoadIntersection(target, [{ column: 5, row: 4 }])).toBe(true);
    expect(isRoadIntersection(target, [{ column: 5, row: 6 }])).toBe(true);
    expect(isRoadIntersection(target, [{ column: 5, row: 4 }, { column: 5, row: 6 }])).toBe(true);
    expect(isRoadIntersection(target, [{ column: 5, row: 4, completesAt: Date.now() + 5000 }])).toBe(true);
  });

  it.each([4, 6])("rejects bridge construction at a main-road junction branching to row %i without writes", async row => {
    const input = await fixture();
    await db.update(farms).set({ roads: [{ column: 5, row }] }).where(eq(farms.id, input.farmId));
    const [before] = await db.select().from(farms).where(eq(farms.id, input.farmId));
    await expect(Effect.runPromise(Effect.flip(buildIrrigation(db, { ...input, target: { column: 5, row: 5 } })))).resolves.toMatchObject({ _tag: "IrrigationTileOccupiedError" });
    const [after] = await db.select().from(farms).where(eq(farms.id, input.farmId));
    expect(after).toEqual(before);
  });
  it("does not use unfinished roads as connections or loading points and keeps the farmer busy", () => {
    const roads = [{ column: 5, row: 4, completesAt: Date.now() + 5000 }];
    expect(validateRoadPlacement({ column: 5, row: 3 }, roads, new Set())).toMatch(/Connect/);
    expect(findLoadingTile(getBuildingFootprint("mill", { column: 5, row: 2 }), roads, [], new Set())).toBeNull();
    expect(() => assertFarmerAvailable({ roads, carriedItemKey: null, fishing: null })).toThrow(/building a road/);
  });
  it("requires cardinal connectivity and supports farmland up to the riverbank", () => {
    expect(validateRoadPlacement({ column: 5, row: 4 }, [], new Set())).toBeNull();
    expect(validateRoadPlacement({ column: 5, row: 3 }, [], new Set())).toMatch(/Connect/);
    expect(validateRoadPlacement({ column: 4, row: 3 }, [{ column: 5, row: 4 }], new Set())).toMatch(/Connect/);
    expect(validateRoadPlacement({ column: 5, row: 4 }, [], new Set(["5:4"]))).toMatch(/empty/);
    expect(validateRoadPlacement({ column: 12, row: 5 }, [], new Set())).toMatch(/inside/);
    expect(isInsideArablePlot({ column: 7, row: 8 })).toBe(true);
    expect(isInsideArablePlot({ column: 7, row: 9 })).toBe(true);
    expect(isInsideArablePlot({ column: 7, row: 10 })).toBe(false);
  });
  it("allows ordinary ground branches but rejects diagonal-only links and water", () => {
    expect(validateRoadPlacement({ column: -1, row: 4 }, [], new Set())).toBeNull();
    expect(validateRoadPlacement({ column: -1, row: 3 }, [{ column: -1, row: 4 }], new Set())).toBeNull();
    expect(validateRoadPlacement({ column: -2, row: 3 }, [{ column: -1, row: 4 }], new Set())).toMatch(/Connect/);
    expect(validateRoadPlacement({ column: -1, row: 10 }, [{ column: -1, row: 9 }], new Set())).toMatch(/river/);
  });
  it("persists ordinary ground roads and rejects disconnected ground commands", async () => {
    const input = await fixture();
    const target = { column: -1, row: 4 };
    const first = await Effect.runPromise(buildRoad(db, { ...input, target }));
    expect(first.farm.roads).toEqual([expect.objectContaining(target)]);
    await finishRoads(input.farmId);
    await expect(Effect.runPromise(Effect.flip(buildRoad(db, { ...input, target: { column: -2, row: 3 }, expectedFarmVersion: first.farm.version })))).resolves.toMatchObject({ _tag: "RoadRuleError", message: expect.stringMatching(/Connect/) });
    const second = await Effect.runPromise(buildRoad(db, { ...input, target: { column: -1, row: 3 }, expectedFarmVersion: first.farm.version }));
    expect(second.farm.roads).toHaveLength(2);
  });
  it("reserves unique road loading tiles and rejects buildings over roads", () => {
    const footprint = getBuildingFootprint("mill", { column: 5, row: 2 });
    const roads = [{ column: 5, row: 4 }];
    expect(findLoadingTile(footprint, roads, [], new Set())).toEqual(roads[0]);
    expect(findLoadingTile(footprint, roads, roads, new Set())).toBeNull();
    expect(findLoadingTile(footprint, roads, [], new Set(["5:4"]))).toBeNull();
    const context = { building: "mill" as const, target: { column: 5, row: 2 }, existingBuildings: [], occupiedCoordinates: new Set<string>(), carriedItem: null, availableMaterials: { reed: 10, clay: 10 } };
    expect(validateBuildingPlacement(context).type).toBe("road_access_required");
    expect(validateBuildingPlacement({ ...context, roads }).type).toBe("valid");
    expect(validateBuildingPlacement({ ...context, roads: [{ column: 5, row: 2 }] }).type).toBe("footprint_occupied");
    expect(validateBuildingPlacement({ ...context, roads, reservedLoadingTiles: roads }).type).toBe("road_access_required");
  });
  it("uses a connected road detour instead of cutting across fields, with off-road fallback", () => {
    const roads = [{ column: 1, row: 1 }, { column: 1, row: 2 }, { column: 1, row: 3 }, { column: 2, row: 3 }, { column: 3, row: 3 }, { column: 3, row: 2 }, { column: 3, row: 1 }];
    const path = findRoadPreferredPath(roads[0]!, roads.at(-1)!, { columns: 5, rows: 5 }, new Set(), new Set(roads.map(roadKey)));
    expect(path).toEqual(roads);
    expect(findRoadPreferredPath({ column: 0, row: 0 }, { column: 4, row: 4 }, { columns: 5, rows: 5 }, new Set(), new Set())).toHaveLength(9);
    expect(findRoadPreferredPath({ column: 0, row: 0 }, { column: 4, row: 4 }, { columns: 5, rows: 5 }, new Set(["4:4"]), new Set())).toBeNull();
  });
  it("persists branches, rejects stale retries and disconnected placements without writes", async () => {
    const input = await fixture();
    const first = await Effect.runPromise(buildRoad(db, input));
    expect(first.farm.roads).toEqual([expect.objectContaining(input.target)]);
    expect(first.farm.roads[0]!.completesAt! - Date.now()).toBeGreaterThan(4000);
    expect(first.farm.version).toBe(2);
    await expect(Effect.runPromise(Effect.flip(buildRoad(db, input)))).resolves.toMatchObject({ _tag: "RoadRuleError", message: expect.stringMatching(/changed/) });
    await expect(Effect.runPromise(Effect.flip(buildRoad(db, { ...input, expectedFarmVersion: 2, target: { column: 0, row: 0 } })))).resolves.toMatchObject({ _tag: "RoadRuleError" });
    await expect(Effect.runPromise(Effect.flip(buildRoad(db, { ...input, expectedFarmVersion: 2, target: { column: 5, row: 3 } })))).resolves.toMatchObject({ message: "Finish building the road first." });
    await finishRoads(input.farmId);
    const second = await Effect.runPromise(buildRoad(db, { ...input, expectedFarmVersion: 2, target: { column: 5, row: 3 } }));
    expect(second.farm.roads).toHaveLength(2);
    expect((await db.select().from(farms).where(eq(farms.id, input.farmId)))[0]!.roads).toEqual(second.farm.roads);
  });
  it("builds and persists a loading point, while canals and dropped goods cannot replace roads", async () => {
    const input = await fixture();
    await Effect.runPromise(buildRoad(db, input));
    await finishRoads(input.farmId);
    await db.insert(farmGroundItems).values([
      { farmId: input.farmId, itemKey: "reed", quantity: 2, column: 0, row: 0 },
      { farmId: input.farmId, itemKey: "clay", quantity: 3, column: 1, row: 0 }
    ]);
    const built = await Effect.runPromise(buildFarmBuilding(db, { ...input, expectedFarmVersion: 2, building: "granary", target: { column: 5, row: 2 } }));
    expect(built.buildings[0]!.loadingTile).toEqual(input.target);
    await expect(Effect.runPromise(Effect.flip(buildIrrigation(db, { ...input, expectedFarmVersion: built.farm.version })))).resolves.toMatchObject({ _tag: "IrrigationTileOccupiedError" });
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1 }).where(eq(farms.id, input.farmId));
    await expect(Effect.runPromise(Effect.flip(dropCarriedItem(db, { ...input, expectedFarmVersion: built.farm.version })))).resolves.toBeDefined();
    expect(await db.select().from(farmGroundItems).where(eq(farmGroundItems.farmId, input.farmId))).toHaveLength(0);
  });
});
