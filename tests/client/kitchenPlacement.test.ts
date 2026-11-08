import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { mockGranaryPlacement, buildingAvailabilityBlocker } from "../../src/client/game/phaser/isometricBuildingPlacement";
import { kitchenAppearance } from "../../src/client/game/phaser/kitchenAppearance";
import { commandUnlockLevel } from "../../src/game-core/farm/commandUnlock";
const kitchenPlacementPreview = (snapshot: ReturnType<typeof FarmSnapshotSchema.parse>, target: { column: number; row: number }, now: number) => {
  const result = mockGranaryPlacement(snapshot, target, { column: 3, row: 5 }, now, false, "kitchen");
  return { ...result, valid: result.rule.type === "valid", columns: 1, rows: 1,
    orientation: kitchenAppearance(target, result.loading).texture.replace("kitchen-", "") };
};

const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
    carriedItem: null, gathering: null }, inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });

it("uses a single tile beside the main road without changing the farm", () => {
  const s = snapshot(), before = JSON.stringify(s);
  expect(kitchenPlacementPreview(s, { column: 4, row: 4 }, 1000)).toMatchObject({
    valid: true, orientation: "horizontal", columns: 1, rows: 1, loading: { column: 4, row: 5 },
  });
  expect(JSON.stringify(s)).toBe(before);
});

it("turns toward a connected road on the other working side", () => {
  const s = snapshot();
  s.farm.roads = [{ column: 5, row: 4 }, { column: 5, row: 3 }];
  expect(kitchenPlacementPreview(s, { column: 4, row: 3 }, 1000)).toMatchObject({ valid: true, orientation: "vertical", columns: 1, rows: 1 });
});

it("rejects disconnected roads, existing roads, fixed buildings and arable ground", () => {
  const s = snapshot();
  s.farm.roads = [{ column: 5, row: 1 }];
  expect(kitchenPlacementPreview(s, { column: 4, row: 1 }, 1000).valid).toBe(false);
  expect(kitchenPlacementPreview(s, { column: 4, row: 5 }, 1000).valid).toBe(false);
  expect(kitchenPlacementPreview(s, { column: 0, row: 3 }, 1000).valid).toBe(false);
  expect(kitchenPlacementPreview(s, { column: 4, row: 7 }, 1000).valid).toBe(false);
});

it("allows free ground south of the main road and a connected road to the west", () => {
  const s = snapshot();
  expect(kitchenPlacementPreview(s, { column: -1, row: 6 }, 1000)).toMatchObject({
    valid: true, loading: { column: -1, row: 5 }, orientation: "horizontal",
  });
  s.farm.roads = [{ column: 5, row: 4 }, { column: 5, row: 3 }];
  expect(kitchenPlacementPreview(s, { column: 6, row: 3 }, 1000)).toMatchObject({
    valid: true, loading: { column: 5, row: 3 }, orientation: "vertical",
  });
});

it("gates both construction commands and the catalogue at level 11", () => {
  expect(commandUnlockLevel({ type: "build_kitchen", target: { column: 4, row: 4 }, expectedFarmVersion: 1 })).toBe(11);
  expect(buildingAvailabilityBlocker(snapshot(), 1000, "kitchen")).toBe("Unlock at level 11");
});
