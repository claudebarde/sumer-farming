import { describe, expect, it } from "vitest";
import { visibleSpriteHit } from "../../src/client/game/phaser/visibleSpriteHit";

describe("visible farmer hit validation", () => {
  const granaryFarmer = { x: 300, y: 100, width: 64, height: 64 };
  it("rejects a previous field position after the farmer has moved to storage", () => {
    expect(visibleSpriteHit(true, 1, granaryFarmer, { x: 100, y: 350 })).toBe(false);
  });
  it("still accepts clicks at the farmer's current position", () => {
    expect(visibleSpriteHit(true, 1, granaryFarmer, { x: 332, y: 132 })).toBe(true);
  });
  it("rejects hidden and transparent worker sprites", () => {
    expect(visibleSpriteHit(false, 1, granaryFarmer, { x: 332, y: 132 })).toBe(false);
    expect(visibleSpriteHit(true, 0, granaryFarmer, { x: 332, y: 132 })).toBe(false);
  });
});
