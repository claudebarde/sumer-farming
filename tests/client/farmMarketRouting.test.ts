import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { FARM_MARKET_ENTRANCE, FARM_MARKET_FOOTPRINT, isFarmMarketTile } from "../../src/game-data/farmMarket";
import { porterPath, porterRoadPath } from "../../src/game-core/farm/porter";
import { plantingTravelPath } from "../../src/game-core/farm/batchPlantingTravel";
import { previewWalkPath, previewWalkable } from "../../src/client/game/phaser/isometricWalking";

const id = "00000000-0000-4000-8000-000000000001";
const snapshot = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 80, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
const routes = {
  walking: (from: { column: number; row: number }, to: { column: number; row: number }) => previewWalkPath(snapshot, from, to, 1000),
  work: (from: { column: number; row: number }, to: { column: number; row: number }) => porterPath([], [], from, to, 1000),
  planting: (from: { column: number; row: number }, to: { column: number; row: number }) => plantingTravelPath(snapshot, from, to, 1000),
};

it.each(Object.entries(routes))("%s routes around the market in both directions", (_name, route) => {
  const north = { column: 11, row: 2 };
  for (const [from, to] of [[north, FARM_MARKET_ENTRANCE], [FARM_MARKET_ENTRANCE, north]] as const) {
    const path = route(from, to)!;
    expect(path.length).toBeGreaterThan(0);
    expect(path.at(-1)).toEqual(to);
    expect(path.some(isFarmMarketTile)).toBe(false);
    expect(path.some(p => p.column === 9)).toBe(true);
    const steps = [from, ...path];
    steps.slice(1).forEach((p, i) => expect(Math.abs(p.column - steps[i]!.column) + Math.abs(p.row - steps[i]!.row)).toBeLessThanOrEqual(1));
  }
});

it("rejects every market footprint tile as a destination, but keeps the road entrance accessible", () => {
  for (const tile of FARM_MARKET_FOOTPRINT) {
    expect(previewWalkable(snapshot, tile, 1000)).toBe(false);
    expect(porterPath([], [], FARM_MARKET_ENTRANCE, tile, 1000)).toBeNull();
    expect(plantingTravelPath(snapshot, FARM_MARKET_ENTRANCE, tile, 1000)).toBeNull();
  }
  expect(previewWalkable(snapshot, FARM_MARKET_ENTRANCE, 1000)).toBe(true);
  expect(porterRoadPath([], [], { column: 1, row: 5 }, FARM_MARKET_ENTRANCE, 1000)?.at(-1)).toEqual(FARM_MARKET_ENTRANCE);
});
