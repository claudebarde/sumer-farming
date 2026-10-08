import { describe, expect, it } from "vitest";
import { validateBreadTreat, validateBeerTreat, validateFishTreat, breadTreatErrors, beerTreatErrors } from "../../src/game-core/farm/wellbeing";

describe("treat cooldown balance", () => {
  it.each([
    ["bread", 6, validateBreadTreat, "bread_cooldown"],
    ["beer", 12, validateBeerTreat, "beer_cooldown"],
    ["fish", 8, validateFishTreat, "fish_cooldown"]
  ] as const)("allows %s again after exactly %i hours", (_item, hours, validate, error) => {
    const lastAt = Date.parse("2026-10-05T00:00:00Z");
    const readyAt = lastAt + hours * 3600000;
    expect(validate(1, 60, lastAt, readyAt - 1)).toBe(error);
    expect(validate(1, 60, lastAt, readyAt)).toBeNull();
  });
  it("explains the shorter bread and beer waits", () => {
    expect(breadTreatErrors.bread_cooldown).toContain("6 hours");
    expect(beerTreatErrors.beer_cooldown).toContain("12 hours");
  });
});
