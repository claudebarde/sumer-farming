import { expect, it } from "vitest";
import { irrigationRemovalBlocked } from "../../src/game-core/farm/irrigation";
import { INITIAL_FARM_CONFIG } from "../../src/game-data/initialFarm";
import { FARM_IMPROVEMENT_DEFINITIONS } from "../../src/game-data/farmImprovements";
import { canDestroyIrrigation } from "../../src/client/game/phaser/isometricIrrigation";
import { FarmSnapshotSchema } from "../../src/schemas/farm";

const target = { column: 3, row: INITIAL_FARM_CONFIG.riverRow - 1 };
it("protects adjacent crops even when another canal could water them", () => {
  expect(irrigationRemovalBlocked(target, [target, { ...target, column: 5 }], [{ ...target, column: 4 }])).toBe(true);
  expect(irrigationRemovalBlocked(target, [target], [{ ...target, row: target.row - 1 }])).toBe(true);
});
it("allows empty ends and diagonal crops, but preserves downstream connections", () => {
  expect(irrigationRemovalBlocked(target, [target], [])).toBe(false);
  expect(irrigationRemovalBlocked(target, [target], [{ column: 4, row: target.row - 1 }])).toBe(false);
  expect(irrigationRemovalBlocked(target, [target, { ...target, row: target.row - 1 }], [])).toBe(true);
});
it("only offers removal for a finished idle canal with empty hands", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const s = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
    farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
      household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } }, inventory: [], objects: [], groundItems: [], crops: [], buildings: [],
    improvements: [{ id, type: "irrigation", ...target, startedAt: new Date(0).toISOString(), completesAt: new Date(5000).toISOString(), destroyStartedAt: null, destroyCompletesAt: null }] });
  expect(canDestroyIrrigation(s, target, 4999)).toBe(false);
  expect(canDestroyIrrigation(s, target, 5000)).toBe(true);
  s.farm.carriedItem = { itemKey: "barley", quantity: 1 };
  expect(canDestroyIrrigation(s, target, 5000)).toBe(false);
  s.farm.carriedItem = null;
  s.improvements[0]!.destroyCompletesAt = new Date(10000).toISOString();
  expect(canDestroyIrrigation(s, target, 5000)).toBe(false);
  expect(FARM_IMPROVEMENT_DEFINITIONS.irrigation.destructionDurationMs).toBe(FARM_IMPROVEMENT_DEFINITIONS.irrigation.constructionDurationMs);
});
