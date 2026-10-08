import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MarketTransactionPreview from "../../src/client/components/MarketTransactionPreview";
import { MARKET_ITEM_DEFINITIONS, marketItemKeys } from "../../src/game-data/marketItems";

const render = (type: "buy" | "sell" | "listing", quantity = 2, stock = 8, balance = 20, unitPrice = 3, label = "barley") =>
  renderToStaticMarkup(createElement(MarketTransactionPreview, { label, stock, balance, transaction: { type, quantity, unitPrice } }));

describe("market transaction previews", () => {
  it("shows current and projected balances for purchases", () => {
    const html = render("buy");
    expect(html).toContain("You have 8 barley / 20 shekels");
    expect(html).toContain("After the transaction: 10 barley / 14 shekels");
  });
  it("updates with quantity, direction and price", () => {
    expect(render("sell", 3)).toContain("After the transaction: 5 barley / 29 shekels");
    expect(render("buy", 3, 8, 20, 4)).toContain("After the transaction: 11 barley / 8 shekels");
  });
  it("does not promise immediate proceeds for player listings", () => {
    const html = render("listing");
    expect(html).toContain("After creating the listing: 6 barley / 20 shekels");
    expect(html).toContain("If all sell: 26 shekels");
  });
  it("explains impossible trades instead of displaying negative balances", () => {
    expect(render("buy", 8)).toContain("not enough shekels");
    expect(render("sell", 9)).toContain("not enough stock");
  });
  it("handles zero balances and singular shekels", () => {
    expect(render("buy", 1, 0, 1, 1)).toContain("After the transaction: 1 barley / 0 shekels");
    expect(render("sell", 1, 1, 0, 1)).toContain("After the transaction: 0 barley / 1 shekel");
  });
  it.each(marketItemKeys)("supports %s without item-specific preview logic", key => {
    const label = MARKET_ITEM_DEFINITIONS[key].label.toLowerCase();
    const html = render("buy", 2, 3, 20, 2, label);
    expect(html).toContain("After the transaction: 5 ");
    expect(html).toContain(" / 16 shekels");
  });
});
