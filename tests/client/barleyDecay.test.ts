import { describe, expect, it } from "vitest";
import { barleyHarvestYield, barleyHasExpired, BARLEY_WITHERING_MS as DAY } from "../../src/game-core/farm/barleyDecay";
import { barleyStage } from "../../src/client/game/phaser/isometricFarm";
import { nextCropTransition } from "../../src/client/game/phaser/cropPresentation";

const crop = { id: "crop", cropKey: "barley" as const, column: 0, row: 8, decayEligible: true,
  sowingStartedAt: new Date(0).toISOString(), plantedAt: new Date(1000).toISOString(),
  growthCompletesAt: new Date(2000).toISOString(), harvestStartedAt: null, harvestCompletesAt: null };

describe("level-10 barley decay", () => {
  it.each([[DAY - 1, 2, "ripe"], [DAY, 1, "withering"], [2 * DAY - 1, 1, "withering"], [2 * DAY, 0, null]] as const)(
    "matches yield and artwork at age %i", (age, quantity, stage) => {
      expect(barleyHarvestYield(crop, 2000 + age)).toBe(quantity);
      expect(barleyStage(crop, 2000 + age)).toBe(stage);
      expect(barleyHasExpired(crop, 2000 + age)).toBe(quantity === 0);
    });
  it("preserves old barley and excludes palms", () => {
    expect(barleyHarvestYield({ ...crop, decayEligible: undefined }, 10 * DAY)).toBe(2);
    expect(barleyHasExpired({ ...crop, decayEligible: false }, 10 * DAY)).toBe(false);
    expect(barleyHasExpired({ ...crop, cropKey: "datePalm" }, 10 * DAY)).toBe(false);
  });
  it("locks yield at work start across thresholds and a delayed completion", () => {
    const working = { ...crop, harvestStartedAt: new Date(2000 + DAY - 1).toISOString() };
    expect(barleyHarvestYield(working, 10 * DAY)).toBe(2);
    expect(barleyHasExpired(working, 10 * DAY)).toBe(false);
    expect(barleyHarvestYield({ ...working, harvestStartedAt: new Date(2000 + DAY).toISOString() }, 10 * DAY)).toBe(1);
  });
  it("schedules visual transitions without server polling", () => {
    expect(nextCropTransition(crop, 2000)).toBe(2000 + DAY);
    expect(nextCropTransition(crop, 2000 + DAY)).toBe(2000 + 2 * DAY);
  });
});
