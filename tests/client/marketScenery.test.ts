import { expect, it } from "vitest";
import { marketScenery } from "../../src/client/game/phaser/marketScenery";
import { isMarketRoad, futureMarketStandOrigins } from "../../src/client/game/phaser/isometricMarketLayout";
import { marketReturnOrigin } from "../../src/client/game/phaser/isometricMarket";
import { footprintContains } from "../../src/client/game/phaser/isometricProjection";

it("scatters ten bushes and ten rocks away from roads, current/future stalls and the return farm", () => {
  expect(marketScenery.filter(p => p.texture.startsWith("bush"))).toHaveLength(10);
  expect(marketScenery.filter(p => p.texture.startsWith("rocks"))).toHaveLength(10);
  expect(new Set(marketScenery.map(p => `${p.column}:${p.row}`)).size).toBe(20);
  const buildings = [marketReturnOrigin, { column: 2, row: 2 }, { column: 5, row: 2 }, ...futureMarketStandOrigins];
  for (const p of marketScenery) {
    expect(isMarketRoad(p)).toBe(false);
    expect(buildings.some(b => footprintContains(b, 2, 3, p))).toBe(false);
  }
});
