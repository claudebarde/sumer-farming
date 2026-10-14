import { describe, expect, it } from "vitest";
import { advanceHappiness, decayHappiness, happinessDecayElapsed } from "../../src/game-core/farm/wellbeing";
import { shrineBlessingActive, shrineSprite, SHRINE_BLESSING_DURATION_MS } from "../../src/game-data/shrine";
import { getBuildingFootprint, validateBuildingPlacement } from "../../src/game-core/farm/buildings";
import { commandUnlockLevel } from "../../src/game-core/farm/commandUnlock";
import { emptyProductionState, ProductionStateSchema } from "../../src/game-data/production";

const hour = 3600000;
const blessing = { buildingId: "00000000-0000-4000-8000-000000000001", startedAt: new Date(hour).toISOString(), expiresAt: new Date(13 * hour).toISOString() };

describe("small shrine blessing", () => {
  it("slows both decay bands by 25%, only within the blessing window", () => {
    expect(decayHappiness({ happiness: 100, checkedAt: hour }, 5 * hour, blessing).happiness).toBe(85);
    expect(decayHappiness({ happiness: 50, checkedAt: hour }, 9 * hour, blessing).happiness).toBe(49);
    expect(decayHappiness({ happiness: 100, checkedAt: 0 }, hour, blessing).happiness).toBe(95);
    expect(decayHappiness({ happiness: 100, checkedAt: 13 * hour }, 14 * hour, blessing).happiness).toBe(95);
    expect(happinessDecayElapsed(0, 14 * hour, blessing)).toBe(11 * hour);
  });
  it("retains partial points and matches offline catch-up across expiry", () => {
    const initial = { happiness: 100, checkedAt: 0 };
    let polled = initial;
    for (let at = 1000; at <= 24 * hour; at += 1000) polled = decayHappiness(polled, at, blessing);
    expect(polled).toEqual(decayHappiness(initial, 24 * hour, blessing));
    const atExpiry = decayHappiness(initial, 14 * hour, blessing);
    const normalized = 14 * hour - happinessDecayElapsed(atExpiry.checkedAt, 14 * hour, blessing);
    expect(decayHappiness({ ...atExpiry, checkedAt: normalized }, 24 * hour))
      .toEqual(decayHappiness(atExpiry, 24 * hour, blessing));
  });
  it("keeps ration and hunger effects, including after the blessing expires", () => {
    expect(advanceHappiness({ happiness: 100, checkedAt: hour }, 2 * hour, 2 * hour, 0, 2 * hour, 8, blessing).happiness).toBe(50);
    const initial = { happiness: 80, checkedAt: 0 };
    const offline = advanceHappiness(initial, 72 * hour, 24 * hour, 3, null, 8, blessing);
    let daily = initial;
    for (let day = 1; day <= 3; day++) daily = advanceHappiness(daily, day * 24 * hour, day * 24 * hour, 1, null, 8, blessing);
    expect(offline).toEqual(daily);
  });
  it("switches sprite at expiry and leaves old saves compatible", () => {
    expect(SHRINE_BLESSING_DURATION_MS).toBe(12 * hour);
    expect(shrineBlessingActive(blessing, hour - 1)).toBe(false);
    expect(shrineSprite(blessing.buildingId, blessing, hour)).toBe("smallShrineWithOfferings");
    expect(shrineSprite(blessing.buildingId, blessing, 13 * hour)).toBe("smallShrine");
    expect(shrineSprite("other", blessing, 2 * hour)).toBe("smallShrine");
    expect(ProductionStateSchema.parse(emptyProductionState()).shrineBlessing).toBeUndefined();
  });
  it("unlocks at level 8 and takes only one northern ground tile", () => {
    expect(commandUnlockLevel({ type: "shrine_offering", item: "beer", buildingId: blessing.buildingId, expectedFarmVersion: 1 })).toBe(8);
    expect(commandUnlockLevel({ type: "build_small_shrine", target: { column: 7, row: 4 }, expectedFarmVersion: 1 })).toBe(8);
    expect(getBuildingFootprint("smallShrine", { column: 7, row: 4 })).toEqual([{ column: 7, row: 4 }]);
    const context = { building: "smallShrine" as const, target: { column: 7, row: 4 }, existingBuildings: [], occupiedCoordinates: new Set<string>(), carriedItem: null, availableMaterials: { reed: 2, clay: 4 } };
    expect(validateBuildingPlacement(context).type).toBe("valid");
    expect(validateBuildingPlacement({ ...context, target: { column: 8, row: 4 } }).type).toBe("valid");
    expect(validateBuildingPlacement({ ...context, target: { column: 8, row: 6 } }).type).toBe("outside_building_ground");
    expect(validateBuildingPlacement({ ...context, existingBuildings: [{ type: "smallShrine" }] })).toEqual({ type: "building_limit", limit: 1 });
  });
});
