import { describe, expect, it } from "vitest";
import { canalConnectionMask } from "../../src/client/game/phaser/isometricIrrigation";
import { ROAD_CONNECTIONS } from "../../src/client/game/phaser/isometricRoads";

const date = (n: number) => new Date(n).toISOString();
const canal = (column: number, row: number) => ({ id: "canal", type: "irrigation" as const, column, row,
  startedAt: date(0), completesAt: date(1000), destroyStartedAt: null, destroyCompletesAt: null });
describe("canal artwork connections", () => {
  it("supports the same sixteen connection masks as roads", () => {
    for (let mask = 0; mask < 16; mask++) {
      const canals = ROAD_CONNECTIONS.filter(c => mask & c.bit).map(c => canal(3 + c.column, 3 + c.row));
      expect(canalConnectionMask({ column: 3, row: 3 }, canals, 1000)).toBe(mask);
    }
  });
  it("connects to the river even without a neighbouring canal tile", () => {
    expect(canalConnectionMask({ column: 3, row: 9 }, [], 1000)).toBe(8);
  });
  it("waits for construction and removes connections at the destruction deadline", () => {
    const target = { column: 3, row: 3 }, neighbour = canal(3, 2);
    expect(canalConnectionMask(target, [neighbour], 999)).toBe(0);
    expect(canalConnectionMask(target, [neighbour], 1000)).toBe(2);
    const removing = { ...neighbour, destroyStartedAt: date(2000), destroyCompletesAt: date(7000) };
    expect(canalConnectionMask(target, [removing], 6999)).toBe(2);
    expect(canalConnectionMask(target, [removing], 7000)).toBe(0);
  });
});
