import { describe, expect, it } from "vitest";
import { findDogWalk, planDogFollow } from "../../src/game-core/fetch";

const bounds = { column: 0, row: 0, columns: 16, rows: 10 };
const dog = { x: 96, y: 96 };
const farmer = { x: 352, y: 96 };

describe("dog following", () => {
  it("keeps catching up to a stationary farmer until one tile away", () => {
    let position = dog;
    for (let step = 0; step < 20; step++) {
      const path = planDogFollow(position, farmer, bounds, () => true, 64);
      if (path.length === 0) break;
      position = path[0]!;
    }
    expect(Math.hypot(position.x - farmer.x, position.y - farmer.y)).toBe(64);
    expect(planDogFollow(position, farmer, bounds, () => true, 64)).toEqual([]);
  });
  it("stays one tile away instead of walking onto the farmer", () => {
    expect(planDogFollow(dog, { x: 160, y: 96 }, bounds, () => true, 64)).toEqual([]);
    const path = planDogFollow(dog, farmer, bounds, () => true, 64);
    const last = path.at(-1)!;
    expect(Math.hypot(last.x - farmer.x, last.y - farmer.y)).toBe(64);
    expect(path).not.toContainEqual(farmer);
  });
  it.each(["building", "field", "canal"])("walks around blocked %s tiles", () => {
    const clear = (column: number, row: number) => !(column === 3 && row <= 2);
    const path = planDogFollow(dog, farmer, bounds, clear, 64);
    expect(path.length).toBeGreaterThan(0);
    for (const point of path) expect(clear(Math.floor(point.x / 64), Math.floor(point.y / 64))).toBe(true);
  });
  it("waits rather than crossing an impassable river", () => {
    expect(planDogFollow(dog, { x: 352, y: 480 }, bounds, (_column, row) => row !== 4, 64)).toEqual([]);
  });
  it("can follow outside the arable square on clear canvas ground", () => {
    const path = planDogFollow(dog, { x: 800, y: 96 }, bounds, () => true, 64);
    expect(path.at(-1)).toEqual({ x: 736, y: 96 });
  });
  it("does not reverse to the previous tile centre after pausing mid-step", () => {
    const path = findDogWalk({ x: 120, y: 96 }, { x: 224, y: 96 }, bounds, () => true, 64);
    expect(path?.[0]).toEqual({ x: 160, y: 96 });
  });
});
