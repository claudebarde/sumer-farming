import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import MarketStockSummary from "../../src/client/components/MarketStockSummary";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
const now = Date.parse("2026-11-10T12:00:00Z");
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = (level: number) => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    progression: { level, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
    household: { happiness: 60, lastBeerAt: null, hungrySince: null, cultivationStartedAt: new Date(now).toISOString(), nextBarleyConsumptionAt: new Date(now+3600000).toISOString() } },
  inventory: [{ itemKey: "barley", quantity: 2 }], objects: [], groundItems: [], crops: [], improvements: [],
  buildings: [{ id, type: "granary", column: 5, row: 3, startedAt: new Date(now-1).toISOString(), completesAt: new Date(now).toISOString(), storedBarley: 4, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0 }] });
it("shows only unlocked market goods and includes empty stock", () => {
  const html = renderToStaticMarkup(createElement(MarketStockSummary, { snapshot: snapshot(5), now }));
  expect(html).toContain('aria-label="Barley: 6"');
  expect(html).toContain('aria-label="Flour: 0"');
  expect(html).not.toContain('aria-label="Dates:');
  expect(html).not.toContain('aria-label="Beer:');
});
it("shows eight tradeable goods at level ten in four alphabetically ordered two-row tables", () => {
  const html = renderToStaticMarkup(createElement(MarketStockSummary, { snapshot: snapshot(10), now }));
  expect(html.match(/<table /g)).toHaveLength(4);
  expect(html.match(/<tr>/g)).toHaveLength(8);
  expect(html).toContain('aria-label="Oil: 0"');
  expect(html).not.toContain('Clay');
  expect(html).not.toContain('<progress');
  expect([...html.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map(match => match[1]))
    .toEqual(["Barley", "Beer", "Bread", "Dates", "Flour", "Groats", "Oil", "Sesame"]);
  for (const table of html.matchAll(/<tbody>(.*?)<\/tbody>/g)) expect(table[1]!.match(/<tr>/g)).toHaveLength(2);
});
