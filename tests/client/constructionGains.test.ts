import { expect, it } from "vitest";
import { FarmSnapshotSchema, type FarmSnapshot } from "../../src/schemas/farm";
import { constructionGains } from "../../src/client/game/phaser/constructionGains";
const id = "00000000-0000-4000-8000-000000000001";
const iso = (n: number) => new Date(n).toISOString();
const loading = { column: 5, row: 5 };
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [{ id, type: "warehouse", column: 5, row: 3,
    storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0, loadingTile: loading, startedAt: iso(0), completesAt: iso(0) }] });
const next = (before: FarmSnapshot) => { const after = structuredClone(before); after.farm.version++; return after; };

it("shows a confirmed construction award once, independently of farm version", () => {
  const before = snapshot(); before.player.constructionAwards = [];
  before.buildings[0]!.completesAt = iso(10000);
  const after = next(before); after.farm.version = before.farm.version;
  after.player.constructionAwards = [{ source: "building:warehouse", points: 50, completedAt: iso(10000) }];
  expect(constructionGains(before, after, 10025)).toEqual([{ cell: { column: 5, row: 3 }, at: 10025, quantity: 50, offsetY: -100 }]);
  expect(constructionGains(after, after, 10050)).toEqual([]);
  expect(constructionGains(before, after, 9000)).toEqual([]);
  expect(constructionGains(before, after, 30000)).toEqual([]);
  before.player.constructionAwards = undefined;
  expect(constructionGains(before, after, 10025)).toEqual([]);
});
it("never mistakes unrelated points or rebuilding for a construction reward", () => {
  const before = snapshot(); before.player.constructionAwards = [{ source: "building:warehouse", points: 50, completedAt: iso(0) }];
  before.buildings[0]!.completesAt = iso(10000);
  const after = next(before); after.player.points = 100;
  expect(constructionGains(before, after, 10025)).toEqual([]);
  before.player.constructionAwards = [];
  expect(constructionGains(before, after, 10025)).toEqual([]);
});
