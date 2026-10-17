import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import MarketQuantityControl from "../../src/client/components/MarketQuantityControl";

const render = (value: number, disabled = false) => renderToStaticMarkup(createElement(MarketQuantityControl,
  { label: "Quantity to buy", value, limit: 2, disabled, onChange: () => {} }));
it("provides labelled controls and enforces the quantity boundaries", () => {
  expect(render(1)).toContain('aria-label="Decrease quantity to buy" disabled=""');
  expect(render(2)).toContain('aria-label="Increase quantity to buy" disabled=""');
  expect(render(1)).toContain('min="1" max="2" step="1"');
});
it("disables both buttons and input while trading or unavailable", () => {
  expect(render(1, true).match(/disabled=""/g)).toHaveLength(3);
});
it("shows a compact unit price beside the selector when provided", () => {
  const html = renderToStaticMarkup(createElement(MarketQuantityControl, {
    label: "Quantity to sell", value: 1, disabled: false, onChange: () => {}, unitPrice: 8
  }));
  expect(html).toContain("Price per item");
  expect(html).toContain("8 shekels");
});
