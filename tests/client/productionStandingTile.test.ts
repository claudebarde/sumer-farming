import { describe, expect, it } from "vitest";
import { productionStandingTile } from "../../src/client/game/phaser/productionStandingTile";

describe("standing beside production goods", () => {
  const roads = [0, 1, 2, 3, 4].map(column => ({ column, row: 5 }));
  it.each(["flour", "groats", "beer", "bread"])("leaves the %s loading tile free", () => {
    expect(productionStandingTile(roads[2]!, roads, [roads[2]!])).toEqual(roads[1]);
  });
  it("skips other product stacks", () => {
    expect(productionStandingTile(roads[2]!, roads, [roads[1]!, roads[2]!])).toEqual(roads[3]);
  });
  it("works on vertical branches", () => {
    expect(productionStandingTile({ column: 3, row: 3 }, [{ column: 3, row: 4 }], [{ column: 3, row: 3 }])).toEqual({ column: 3, row: 4 });
  });
  it("does not move a farmer already clear of goods", () => {
    expect(productionStandingTile(roads[0]!, roads, [roads[2]!])).toEqual(roads[0]);
  });
});
