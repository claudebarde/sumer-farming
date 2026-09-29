import { describe, expect, it } from "vitest";
import { advanceDogGlance } from "../../src/client/game/phaser/dogGlance";

describe("sitting dog glance", () => {
  it.each([false, true])("returns to its original facing (%s) after one second", originalFlip => {
    const start = advanceDogGlance({ type: "waiting", nextAt: 5000 }, 5000, true, originalFlip, 6000);
    expect(start.flipX).toBe(!originalFlip);
    expect(advanceDogGlance(start.state, 5999, true, start.flipX, 6000).flipX).toBe(!originalFlip);
    expect(advanceDogGlance(start.state, 6000, true, start.flipX, 6000))
      .toEqual({ state: { type: "waiting", nextAt: 12000 }, flipX: originalFlip });
  });
  it("does not flip before the random delay", () => {
    expect(advanceDogGlance({ type: "waiting", nextAt: 9000 }, 8999, true, false, 5000).flipX).toBe(false);
  });
  it("cancels a glance when movement begins", () => {
    expect(advanceDogGlance({ type: "looking", returnAt: 6000, originalFlip: true }, 5500, false, false, 5000))
      .toEqual({ state: { type: "waiting", nextAt: 10500 }, flipX: true });
  });
});
