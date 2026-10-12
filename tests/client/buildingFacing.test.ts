import { describe, expect, it } from "vitest";
import { buildingFacingLeft } from "../../src/client/game/phaser/buildingFacing";
import { pickupPose } from "../../src/client/game/phaser/isometricPickup";

describe("facing a building at handoff", () => {
  it("turns toward the farm before unloading, instead of retaining a leftward approach", () => {
    const path = [{ column: 2, row: 5 }, { column: 1, row: 5 }], farm = { column: 1, row: 3 };
    expect(pickupPose(path, 1000, 1179, farm)).toMatchObject({ walking: true, facingLeft: true });
    expect(pickupPose(path, 1000, 1180, farm)).toMatchObject({ walking: false, facingLeft: false, done: false });
    expect(pickupPose(path, 1000, 1480, farm)).toMatchObject({ facingLeft: false, done: false });
    expect(pickupPose(path, 1000, 1780, farm)).toMatchObject({ facingLeft: false, done: true });
  });
  it("also faces left for a building on the other side", () => {
    const path = [{ column: 2, row: 1 }, { column: 2, row: 0 }], building = { column: 0, row: 0 };
    expect(pickupPose(path, 0, 179, building).facingLeft).toBe(false);
    expect(pickupPose(path, 0, 180, building).facingLeft).toBe(true);
  });
  it("uses projected position rather than columns and handles an already-arrived farmer", () => {
    const position = { column: 1, row: 5 }, farm = { column: 1, row: 3 };
    expect(buildingFacingLeft(position, farm, true)).toBe(false);
    expect(pickupPose([position], 0, 0, farm)).toMatchObject({ walking: false, facingLeft: false, done: false });
  });
  it("preserves facing when vertically aligned and leaves ground transfers unchanged", () => {
    expect(buildingFacingLeft({ column: 1, row: 1 }, { column: 0, row: 0 }, true)).toBe(true);
    const path = [{ column: 2, row: 5 }, { column: 1, row: 5 }];
    expect(pickupPose(path, 0, 300).facingLeft).toBe(true);
  });
});
