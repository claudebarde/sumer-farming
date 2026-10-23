import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("../../src/client/game/phaser/config", () => ({ TILE_SIZE: 64 }));
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import IsometricMillUpgrade from "../../src/client/components/IsometricMillUpgrade";
import { TileActionsBusy } from "../../src/client/components/tileActionsBusy";
import { isometricTilePopup } from "../../src/client/game/phaser/isometricTilePopup";

const id = "00000000-0000-4000-8000-000000000001";
const date = (n: number) => new Date(n).toISOString();
const fixture = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 100 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    progression: { level: 8, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
    household: { happiness: 70, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [],
  buildings: [{ id, type: "mill", column: 4, row: 3, startedAt: date(0), completesAt: date(1), storedBarley: 0,
    brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0 }] });
const render = (snapshot = fixture(), now = 1000) => renderToStaticMarkup(createElement(TileActionsBusy.Provider, { value: true },
  createElement(IsometricMillUpgrade, { snapshot, buildingId: id, now })));

it("offers the paid upgrade independently of farmer busy state and carried goods", () => {
  const s = fixture();
  s.farm.carriedItem = { itemKey: "water", quantity: 1, expiresAt: null };
  expect(render(s)).toContain('<span>Upgrade to level 2 · 100 shekels</span>');
  expect(render(s)).toContain('upgrade-building-icon.png');
  expect(render(s)).not.toContain('disabled=""');
  expect(render(s)).toContain("Upgrade for 15% shorter milling times than level 1. Takes 5 minutes.");
});
it("explains missing funds but hides upgrades locked by estate level", () => {
  const s = fixture(); s.player.shekelBalance = 99;
  expect(render(s)).toContain('disabled=""');
  expect(render(s)).toContain('<span>Not enough shekels.</span>');
  s.player.shekelBalance = 100; s.farm.progression!.level = 7;
  expect(render(s)).toBe("");
});
it("shows saved progress and updates the mill badge at the deadline without new artwork", () => {
  const s = fixture();
  s.farm.production.buildingUpgrades = { [id]: [{ level: 2, startedAt: date(1000), completesAt: date(301000), idempotencyKey: id }] };
  expect(render(s, 151000)).toContain('aria-label="Mill upgrade progress" max="100" value="50"');
  expect(render(s, 151000)).toContain("2:30");
  expect(render(s, 151000)).not.toContain("<button");
  expect(isometricTilePopup(s, { column: 4, row: 3 }, 300999).level).toBe(1);
  expect(isometricTilePopup(s, { column: 4, row: 3 }, 301000).level).toBe(2);
  expect(render(s, 301000)).toBe("");
  s.farm.progression!.level = 10;
  s.player.shekelBalance = 200;
  expect(render(s, 301000)).toContain("Upgrade to level 3 · 200 shekels");
});
it("blocks the upgrade for active milling or another building upgrade", () => {
  const s = fixture();
  s.farm.milling = { buildingId: id, recipe: "flour", startedAt: date(1000), completesAt: date(301000), barley: 2, output: 1 };
  expect(render(s)).toContain('disabled=""');
  expect(render(s)).toContain('<span>Finish milling before upgrading.</span>');
  s.farm.milling = null;
  s.farm.production.buildingUpgrades = { other: [{ level: 2, startedAt: date(1000), completesAt: date(301000), idempotencyKey: id }] };
  expect(render(s)).toContain('disabled=""');
  expect(render(s)).toContain('<span>Finish the current building upgrade first.</span>');
});
