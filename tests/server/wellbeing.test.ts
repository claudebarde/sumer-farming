import { describe, expect, it } from "vitest";
import { getFarmerMood, happinessAfterFeeding, farmerMovementDurationMultiplier } from "../../src/game-core/farm/wellbeing";
import { HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER } from "../../src/game-data/household";
import { validateBeerTreat, happinessAfterBeer } from "../../src/game-core/farm/wellbeing";

describe("farmer wellbeing", () => {
  it("enforces the exact 24-hour beer boundary and caps happiness", () => {
    expect(validateBeerTreat(1, 70, 1000, 86400999)).toBe("beer_cooldown");
    expect(validateBeerTreat(1, 70, 1000, 86401000)).toBeNull();
    expect(happinessAfterBeer(95)).toBe(100);
    expect(happinessAfterBeer(50)).toBe(65);
  });
  it.each([[0, "unhappy"], [39, "unhappy"], [40, "content"], [69, "content"], [70, "happy"], [100, "happy"]] as const)(
    "classifies happiness %i as %s", (score, mood) => expect(getFarmerMood(score)).toBe(mood)
  );
  it("never makes a farmer unhappy through food shortages alone", () => {
    let score = 100;
    for (let day = 0; day < 100; day++) score = happinessAfterFeeding(score, true, false);
    expect(score).toBe(50);
    expect(getFarmerMood(score)).toBe("content");
    expect(happinessAfterFeeding(45, true, false)).toBe(45);
    expect(happinessAfterFeeding(20, true, false)).toBe(20);
  });
  it("does not decay with absence or reward repeated checks, and caps recovery", () => {
    expect(happinessAfterFeeding(70, false, false)).toBe(70);
    expect(happinessAfterFeeding(50, false, true)).toBe(60);
    expect(happinessAfterFeeding(95, false, true)).toBe(100);
  });
  it("uses the strongest slowdown without stacking", () => {
    expect(farmerMovementDurationMultiplier(70, false)).toBe(1);
    expect(farmerMovementDurationMultiplier(50, false)).toBe(1);
    expect(farmerMovementDurationMultiplier(20, false)).toBeCloseTo(1 / 0.9);
    expect(farmerMovementDurationMultiplier(20, true)).toBe(HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER);
  });
});
