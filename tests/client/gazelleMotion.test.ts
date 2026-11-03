import { describe, expect, it } from "vitest";
import { gazelleGrazePose, gazellesTooClose } from "../../src/client/game/phaser/gazelleMotion";

describe("gazelle herd motion", () => {
  it("keeps screen-space clearance even for different ground tiles", () => {
    expect(gazellesTooClose({ column: 0, row: 12 }, { column: 1, row: 13 })).toBe(true);
    expect(gazellesTooClose({ column: 0, row: 12 }, { column: 2, row: 12 })).toBe(false);
  });
  it("gives all five starting gazelles enough clearance", () => {
    const positions = Array.from({ length: 5 }, (_, i) => ({ column: -3 + i % 3 * 2, row: i < 3 ? 12 : 15 }));
    positions.forEach((a,i) => positions.slice(i+1).forEach(b => expect(gazellesTooClose(a,b)).toBe(false)));
  });
  it("plays lowering, chewing and raising with no frame blending", () => {
    expect(gazelleGrazePose(0,6500)).toEqual({ kind: "lower", index: 0 });
    expect(gazelleGrazePose(1119,6500)).toEqual({ kind: "lower", index: 7 });
    for (let index = 0; index < 4; index++) {
      expect(gazelleGrazePose(1120 + index*220,6500)).toEqual({ kind: "chew", index });
    }
    expect(gazelleGrazePose(5380,6500)).toEqual({ kind: "lower", index: 7 });
    expect(gazelleGrazePose(6500,6500)).toEqual({ kind: "lower", index: 0 });
  });
});
