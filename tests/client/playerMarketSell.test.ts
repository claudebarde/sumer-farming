import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import PlayerMarketSell from "../../src/client/components/PlayerMarketSell";
import { buildMarketQuotes } from "../../src/server/services/marketQuotes";
const item = buildMarketQuotes([], "player").items.find(item => item.itemKey === "barley")!;
const props = { item, quantity: 2, price: 3, stock: 5, limit: 4, availableStorage: 10, balance: 20, pending: false, farmVersion: 1,
  onQuantity: () => {}, onPrice: () => {}, onSell: () => {}, onRefresh: () => {}, onCancel: async () => {} };
it("distinguishes an empty market from a price suggestion and shows reusable quantity controls", () => {
  const html = renderToStaticMarkup(createElement(PlayerMarketSell, props));
  expect(html).toContain("No active listings");
  expect(html).toContain("Starting suggestion:");
  expect(html).toContain('aria-label="Decrease Barley quantity to sell"');
  expect(html).toContain("Total asking value");
  expect(html).toContain("6 shekels");
  expect(html).toContain("units traded in 24h");
  expect(html).not.toContain("Medium demand");
});
it("retains the planting reserve restriction", () => {
  const html = renderToStaticMarkup(createElement(PlayerMarketSell, { ...props, quantity: 5 }));
  expect(html).not.toContain(">List for sale<");
  expect(html).toContain('disabled=""');
});
it("shows live asking prices separately from actual traded volume", () => {
  const html = renderToStaticMarkup(createElement(PlayerMarketSell, { ...props, item: { ...item, playerMarket: { ...item.playerMarket, lowestSellPrice: 2, weightedAverageSellPrice: 3, totalSellQuantity: 10, recentTradeQuantity: 7, recentTradeAveragePrice: 2.5 } } }));
  expect(html).toContain("From 2 shekels");
  expect(html).toContain("Average 3 shekels");
  expect(html).toContain("<strong>7</strong> units traded in 24h");
  expect(html).toContain("<strong>10</strong> units for sale");
});
