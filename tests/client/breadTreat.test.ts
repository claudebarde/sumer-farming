import { describe, expect, it } from "vitest";
import { happinessAfterBread, validateBreadTreat } from "../../src/game-core/farm/wellbeing";
import { BREAD_TREAT_INTERVAL_MS, BREAD_HAPPINESS_BOOST, BEER_HAPPINESS_BOOST, FISH_HAPPINESS_BOOST } from "../../src/game-data/household";

describe("bread treats", () => {
  it("matches beer, exceeds fish and caps happiness", () => {
    expect(BREAD_HAPPINESS_BOOST).toBeGreaterThan(FISH_HAPPINESS_BOOST);
    expect(BREAD_HAPPINESS_BOOST).toBe(BEER_HAPPINESS_BOOST);
    expect(happinessAfterBread(50)).toBe(65);
    expect(happinessAfterBread(95)).toBe(100);
  });
  it("requires stock, space for happiness and a full cooldown", () => {
    expect(validateBreadTreat(0, 50, null, 0)).toBe("no_bread");
    expect(validateBreadTreat(1, 100, null, 0)).toBe("happiness_full");
    expect(validateBreadTreat(1, 50, 0, BREAD_TREAT_INTERVAL_MS - 1)).toBe("bread_cooldown");
    expect(validateBreadTreat(1, 50, 0, BREAD_TREAT_INTERVAL_MS)).toBeNull();
  });
});
