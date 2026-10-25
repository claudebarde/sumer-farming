import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { shrineOfferingBlocker } from "../../src/client/game/phaser/isometricShrine";
import IsometricShrineActions from "../../src/client/components/IsometricShrineActions";

const id = "00000000-0000-4000-8000-000000000001";
const fixture = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    progression: { level: 8, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
    household: { happiness: 70, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [{ itemKey: "bread", quantity: 2 }, { itemKey: "beer", quantity: 2 }], objects: [], groundItems: [], crops: [], improvements: [],
  buildings: [{ id, type: "smallShrine", column: -3, row: 4, loadingTile: { column: -3, row: 5 },
    startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString(), storedBarley: 0,
    brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0 }] });

it("offers bread and beer with their approved icons", () => {
  const s = fixture();
  for (const item of ["bread", "beer"] as const) expect(shrineOfferingBlocker(s, id, item, 1000)).toBeNull();
  const html = renderToStaticMarkup(createElement(IsometricShrineActions, { snapshot: s, buildingId: id, now: 1000, onOffer: () => {} }));
  expect(html).toContain("Offer 2 bread");
  expect(html).toContain("Offer 2 beer");
  expect(html).toContain("bread-basket-isometric.png");
  expect(html).toContain("beer-jars-full-isometric.png");
  expect(html).not.toContain('disabled=""');
});

it("blocks missing stock, occupied hands, construction and active blessings", () => {
  const s = fixture();
  s.inventory = [];
  expect(shrineOfferingBlocker(s, id, "bread", 1000)).toContain("Store 2 bread");
  s.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
  expect(shrineOfferingBlocker(s, id, "beer", 1000)).toContain("hands");
  s.farm.carriedItem = null;
  s.buildings[0]!.completesAt = new Date(2000).toISOString();
  expect(shrineOfferingBlocker(s, id, "beer", 1000)).toContain("construction");
  s.buildings[0]!.completesAt = new Date(1).toISOString();
  s.farm.production.shrineBlessing = { buildingId: id, item: "beer", startedAt: new Date(0).toISOString(), expiresAt: new Date(3600000).toISOString() };
  expect(shrineOfferingBlocker(s, id, "bread", 1000)).toContain("blessing");
  const html = renderToStaticMarkup(createElement(IsometricShrineActions, { snapshot: s, buildingId: id, now: 1000, onOffer: () => {} }));
  expect(html).toContain("0:59:59 remaining");
  expect(html).toContain('aria-label="Blessing progress"');
  expect(html).not.toContain("<button");
});

it("counts down from saved timestamps and restores offering controls at expiry", () => {
  const s = fixture();
  s.farm.production.shrineBlessing = { buildingId: id, item: "bread", startedAt: new Date(0).toISOString(), expiresAt: new Date(43200000).toISOString() };
  const render = (now: number) => renderToStaticMarkup(createElement(IsometricShrineActions, { snapshot: s, buildingId: id, now, onOffer: () => {} }));
  expect(render(0)).toContain('value="0"');
  expect(render(10800000)).toContain('value="25"');
  expect(render(10800000)).toContain("9:00:00 remaining");
  expect(render(32400000)).toContain('value="75"');
  expect(render(32400000)).toContain("3:00:00 remaining");
  expect(render(21600000)).toContain("6:00:00 remaining");
  expect(render(21600000)).toContain('value="50"');
  expect(render(43199000)).toContain("0:00:01 remaining");
  expect(render(43200000)).not.toContain("<progress");
  expect(render(43200000).match(/<button/g)).toHaveLength(2);
});

it("replaces both offering buttons with one busy alert during work", () => {
  const s = fixture();
  s.farm.gathering = { itemKey: "clay", target: { column: 1, row: 1 },
    startedAt: new Date(0).toISOString(), completesAt: new Date(2000).toISOString() };
  const html = renderToStaticMarkup(createElement(IsometricShrineActions, { snapshot: s, buildingId: id, now: 1000, onOffer: () => {} }));
  expect(html).toMatch(/<p class="[^"]*alert[^"]*" role="alert">The farmer is busy<\/p>/);
  expect(html).not.toContain("<button");
});

it("does not describe an idle farmer with full hands as busy", () => {
  const s = fixture();
  s.farm.carriedItem = { itemKey: "water", quantity: 1, expiresAt: null };
  const html = renderToStaticMarkup(createElement(IsometricShrineActions, { snapshot: s, buildingId: id, now: 1000, onOffer: () => {} }));
  expect(html).not.toContain("The farmer is busy");
  expect(html.match(/<button/g)).toHaveLength(2);
  expect(html).toContain("Empty the farmer");
});
