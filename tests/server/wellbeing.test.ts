import { describe, expect, it } from "vitest";
import { getFarmerMood, happinessAfterFeeding, farmerMovementDurationMultiplier } from "../../src/game-core/farm/wellbeing";
import { HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER } from "../../src/game-data/household";
import { validateBeerTreat, validateFishTreat, happinessAfterBeer } from "../../src/game-core/farm/wellbeing";
import { decayHappiness, advanceHappiness } from "../../src/game-core/farm/wellbeing";

const hour = 60 * 60 * 1000;
describe("happiness decay", () => {
  it.each([1, 2, 3])("protects level %i during long absences and shortages", level => {
    const result = advanceHappiness({ happiness: 100, checkedAt: 0 }, 1000 * hour, 24 * hour, 0, 24 * hour, level);
    expect(result).toEqual({ happiness: 70, checkedAt: 1000 * hour });
    expect(getFarmerMood(result.happiness)).toBe("happy");
    expect(farmerMovementDurationMultiplier(result.happiness, true, level)).toBe(1);
    expect(advanceHappiness({ happiness: 20, checkedAt: 0 }, 0, 0, 0, null, level).happiness).toBe(70);
    expect(advanceHappiness({ happiness: 90, checkedAt: 0 }, 0, 0, 0, 0, level).happiness).toBe(90);
  });
  it("preserves automatic feeding boosts during the introduction", () => {
    expect(advanceHappiness({ happiness: 70, checkedAt: 0 }, 24 * hour, 24 * hour, 1, null, 1).happiness).toBe(80);
  });
  it("enables normal decay and hunger slowdown from level 4", () => {
    expect(advanceHappiness({ happiness: 70, checkedAt: 0 }, hour, 0, 0, null, 4).happiness).toBe(65);
    expect(farmerMovementDurationMultiplier(70, true, 4)).toBe(HUNGRY_FARMER_MOVEMENT_DURATION_MULTIPLIER);
    expect(validateFishTreat(1, 70, null, 0)).toBeNull();
  });
  it("drops faster to 50, then slows down and never goes below zero", () => {
    const initial = { happiness: 100, checkedAt: 0 };
    expect(decayHappiness(initial, 8 * hour).happiness).toBe(60);
    expect(decayHappiness(initial, 10 * hour).happiness).toBe(50);
    expect(decayHappiness(initial, 16 * hour).happiness).toBe(49);
    expect(decayHappiness(initial, 76 * hour).happiness).toBe(39);
    expect(decayHappiness(initial, 10000 * hour).happiness).toBe(0);
  });
  it("preserves partial intervals, and repeated polling matches offline simulation", () => {
    const initial = { happiness: 100, checkedAt: 0 };
    let state = initial;
    for (let time = 1000; time <= 80 * hour; time += 1000) state = decayHappiness(state, time);
    expect(state).toEqual(decayHappiness(initial, 80 * hour));
    expect(decayHappiness(initial, -1)).toEqual(initial);
  });
  it("applies offline rations at their deadlines rather than awarding boosts at login", () => {
    const initial = { happiness: 100, checkedAt: 0 };
    const offline = advanceHappiness(initial, 100 * hour, 24 * hour, 4, null);
    let online = initial;
    for (let day = 1; day <= 4; day++) online = advanceHappiness(online, day * 24 * hour, day * 24 * hour, 1, null);
    expect(offline).toEqual(decayHappiness(online, 100 * hour));
  });
  it("limits the direct shortage penalty to 50 while natural decay continues", () => {
    const initial = { happiness: 100, checkedAt: 0 };
    const hungry = advanceHappiness(initial, 0, 0, 0, 0);
    expect(hungry.happiness).toBe(50);
    expect(decayHappiness(hungry, 6 * hour).happiness).toBe(49);
  });
});

describe("farmer wellbeing", () => {
  it("allows fish at the exact eight-hour boundary", () => {
    expect(validateFishTreat(1, 50, 1000, 1000 + 8 * hour - 1)).toBe("fish_cooldown");
    expect(validateFishTreat(1, 50, 1000, 1000 + 8 * hour)).toBeNull();
  });
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
  it("only feeding events grant recovery and cap it at 100", () => {
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
