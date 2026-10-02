import { describe, expect, it } from "vitest";
import { breadOvenSprite, farmerProductionJob } from "../../src/game-core/farm/farmerProduction";
import { emptyProductionState } from "../../src/game-data/production";
import { assertFarmerAvailable } from "../../src/server/services/farmerAvailability";

const job = { startedAt: "2026-09-30T12:00:00Z", completesAt: "2026-09-30T12:05:00Z", output: 2 };
const production = { ...emptyProductionState(), baking: { oven: job } };

describe("farmer production occupancy", () => {
  it("restores the baking lock from persisted production", () => {
    expect(farmerProductionJob({ production: JSON.parse(JSON.stringify(production)) })).toEqual({ type: "baking", buildingId: "oven" });
    expect(() => assertFarmerAvailable({ production, fishing: null, carriedItemKey: null })).toThrow("Wait for baking to finish");
  });
  it("releases the farmer when bread is pending collection", () => {
    const completed = { ...emptyProductionState(), pending: { oven: { itemKey: "bread" as const, quantity: 2 } } };
    expect(farmerProductionJob({ production: completed })).toBeNull();
    expect(() => assertFarmerAvailable({ production: completed, fishing: null, carriedItemKey: null })).not.toThrow();
  });
  it("retains milling occupancy and leaves unattended brewing free", () => {
    expect(farmerProductionJob({ milling: { buildingId: "mill" } })).toEqual({ type: "milling", buildingId: "mill" });
    expect(farmerProductionJob({ production: emptyProductionState() })).toBeNull();
  });
  it("shows the busy oven only for its active job and idle when completed", () => {
    expect(breadOvenSprite("oven", production)).toBe("breadOvenBusy");
    expect(breadOvenSprite("other", production)).toBe("breadOven");
    expect(breadOvenSprite("oven", emptyProductionState())).toBe("breadOven");
  });
});
