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
    expect(html).toContain('aria-label="Current"');
    expect(html).toContain('aria-label="After trade"');
    expect(html).toContain("<dd>8</dd>");
    expect(html).toContain("<dd>20</dd>");
    expect(html).toContain("<dd>10<span");
    expect(html).toContain("<dd>14<span");
  });
  it("updates with quantity, direction and price", () => {
    expect(render("sell", 3)).toContain("<dd>29<span");
    expect(render("buy", 3, 8, 20, 4)).toContain("<dd>11<span");
  });
  it("does not promise immediate proceeds for player listings", () => {
    const html = render("listing");
    expect(html).toContain('aria-label="After listing"');
    expect(html).toContain("<dd>6<span");
    expect(html.match(/<dd>20<\/dd>/g)).toHaveLength(2);
    expect(html).toContain("If all sell: 26 shekels");
  });
  it("explains impossible trades instead of displaying negative balances", () => {
    expect(render("buy", 8)).toContain("not enough shekels");
    expect(render("sell", 9)).toContain("not enough stock");
  });
  it("handles zero balances and singular shekels", () => {
    expect(render("buy", 1, 0, 1, 1)).toContain("<dd>0<span");
    expect(render("sell", 1, 1, 0, 1)).toContain("<dd>1<span");
    expect(render("buy", 1, 0, 1, 1)).toContain("1 shekel</strong>");
  });
  it.each(marketItemKeys)("supports %s without item-specific preview logic", key => {
    const label = MARKET_ITEM_DEFINITIONS[key].label.toLowerCase();
    const html = render("buy", 2, 3, 20, 2, label);
    expect(html).toContain("<dd>5<span");
    expect(html).toContain("<dd>16<span");
    expect(html).not.toContain(" / ");
  });
});
