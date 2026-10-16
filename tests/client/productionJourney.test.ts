import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { planProductionJourney, productionArrivalAt } from "../../src/game-core/farm/productionJourney";
import { positionAlongPorterPath } from "../../src/client/game/phaser/porterPresentation";
import { getBuildingFootprint } from "../../src/game-core/farm/buildings";

const targetId = "00000000-0000-4000-8000-000000000003";
const snapshot = FarmSnapshotSchema.parse({
  created: false, player: { shekelBalance: 0 },
  farm: { id: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", version: 1,
    household: { happiness: 80, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
  inventory: [{ itemKey: "barley", quantity: 6 }, { itemKey: "flour", quantity: 2 }],
  objects: [], groundItems: [], crops: [], improvements: [],
  buildings: [{ id: targetId, type: "breadOven", column: 0, row: 1, loadingTile: { column: -1, row: 1 },
    startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString(), storedBarley: 0,
    brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0 }]
});
describe("one saved preparation timeline", () => {
  it.each(["baking", "brewing", "milling", "donkeyMilling"] as const)("%s arrives exactly at production start, including after reload", kind => {
    const journey = planProductionJourney(snapshot, targetId, 10_000,
      { farmerPosition: { column: 6, row: 5 }, donkeyPosition: { column: 7, row: 2 } }, kind)!;
    expect(journey).not.toBeNull();
    const duration = productionArrivalAt(journey) - journey.departedAt;
    expect(duration).toBe(Math.ceil((journey.path.length - 1) * journey.stepDurationMs));
    const restored = JSON.parse(JSON.stringify(journey)) as typeof journey;
    expect(positionAlongPorterPath(restored.path, 1)).toEqual({ column: -1, row: 1 });
    expect(positionAlongPorterPath(restored.path, 1 - journey.stepDurationMs / duration)).not.toEqual(restored.path.at(-1));
    expect(journey.path[journey.supplyIndex]).toEqual({ column: 1, row: 5 });
    const footprints = snapshot.buildings.flatMap(b => getBuildingFootprint(b.type, b));
    expect(journey.path.some(p => footprints.some(b => b.column === p.column && b.row === p.row))).toBe(false);
    expect(journey.path.every(p => p.row < 10)).toBe(true);
    if (kind === "donkeyMilling") {
      expect(journey.path[journey.donkeyPickupIndex!]).toEqual({ column: 7, row: 2 });
      expect(journey.donkeyDropIndex).toBeLessThanOrEqual(journey.supplyIndex);
    }
  });
  it("shorter routes start sooner instead of waiting out a fixed allowance", () => {
    const near = planProductionJourney(snapshot, targetId, 0, { farmerPosition: { column: 1, row: 5 } }, "baking")!;
    const far = planProductionJourney(snapshot, targetId, 0, { farmerPosition: { column: 10, row: 5 } }, "baking")!;
    expect(productionArrivalAt(near)).toBeLessThan(productionArrivalAt(far));
  });
  it("rejects an inaccessible hint and starts from the farm without crossing buildings", () => {
    const journey = planProductionJourney(snapshot, targetId, 0, { farmerPosition: { column: 0, row: 1 } }, "baking")!;
    expect(journey.path[0]).toEqual({ column: 1, row: 5 });
  });
});
