import { describe, expect, it } from "vitest";
import { roadRemovalReason } from "../../src/game-core/farm/roads";

const a = { column: 5, row: 4 }, b = { column: 5, row: 3 }, c = { column: 6, row: 3 };
describe("road removal connectivity", () => {
  it("allows a branch end but protects its trunk with a tile count", () => {
    expect(roadRemovalReason(c, [a, b, c], [], 0)).toBeNull();
    expect(roadRemovalReason(a, [a, b, c], [], 0)).toMatch(/disconnect 2 road tiles/);
    expect(roadRemovalReason(b, [a, b], [], 0)).toBeNull();
  });
  it("allows a loop with another main-road connection", () => {
    expect(roadRemovalReason(a, [a, b, c, { column: 6, row: 4 }], [], 0)).toBeNull();
  });
  it("counts unfinished roads and rejects diagonal-only access", () => {
    expect(roadRemovalReason(a, [a, { ...b, completesAt: 1000 }, { column: 6, row: 4 }], [], 0)).toMatch(/disconnect 1 road tile/);
  });
  it("protects the main road, loading tiles and ongoing work", () => {
    expect(roadRemovalReason({ column: 5, row: 5 }, [], [], 0)).toMatch(/main road/);
    expect(roadRemovalReason(a, [a], [a], 0)).toMatch(/loading access/);
    expect(roadRemovalReason(a, [{ ...a, removing: true, completesAt: 5000 }], [], 0)).toMatch(/completed/);
    expect(roadRemovalReason(a, [], [], 0)).toMatch(/completed/);
  });
});
