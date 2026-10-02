import { describe, expect, it } from "vitest";
import { dogFacingMouse } from "../../src/client/game/phaser/dogFacing";

describe("dog mouse facing", () => {
  it.each([false, true])("faces the mouse regardless of previous flip %s", flip => {
    expect(dogFacingMouse(100, 50, flip)).toBe(true);
    expect(dogFacingMouse(100, 150, flip)).toBe(false);
  });
  it.each([false, true])("retains facing %s without a mouse or at the exact center", flip => {
    expect(dogFacingMouse(100, null, flip)).toBe(flip);
    expect(dogFacingMouse(100, 100, flip)).toBe(flip);
  });
  it("updates relative to the dog's new position after following", () => {
    expect(dogFacingMouse(100, 150, false)).toBe(false);
    expect(dogFacingMouse(200, 150, false)).toBe(true);
  });
});
