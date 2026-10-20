import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import MerchantRequestCard from "../../src/client/components/MerchantRequestCard";
import { NPC_REQUESTS } from "../../src/game-data/npcRequests";

const render = (slot: number, stock = { barley: 10, beer: 6 }, overrides = {}) => renderToStaticMarkup(createElement(MerchantRequestCard, {
  request: { ...NPC_REQUESTS.brewer[slot]!, slot, completed: false }, stock,
  pending: false, onDeliver: () => {}, ...overrides,
}));
it("shows the existing story, product, required amount, stock and reward", () => {
  const html = render(0);
  expect(html).toContain("Neighbouring household");
  expect(html).toContain("Barley for the family table.");
  expect(html).toContain("3 needed");
  expect(html).toContain("You have <strong>10</strong>");
  expect(html).toContain("5 shekels");
  expect(html).toContain("/shekels.png");
  expect(html).not.toContain("disabled");
});
it("uses the full beer icon and shows both goods for a mixed request", () => {
  expect(render(1)).toContain("beer-jars-full-isometric.png");
  const html = render(2);
  expect(html).toContain("4 needed");
  expect(html).toContain("2 needed");
  expect(html).toContain("You have <strong>6</strong>");
  expect(html).toContain("18 shekels");
});
it("explains insufficient stock and disables confirmation", () => {
  const html = render(2, { barley: 4, beer: 1 });
  expect(html).toContain('data-enough="false"');
  expect(html).toContain("Store the missing goods");
  expect(html).toContain("disabled");
});
it("preserves pending guards and the ration warning", () => {
  expect(render(0, undefined, { pending: true })).toContain("Delivering…");
  expect(render(0, { barley: 3, beer: 0 })).toContain("next ration");
});
it("keeps deliveries enabled during unrelated farm-version refreshes", () => {
  const source = readFileSync(new URL("../../src/client/components/NpcRequests.tsx", import.meta.url), "utf8");
  expect(source).not.toContain("response?.version !== version");
  expect(source).not.toContain("stale=");
  expect(render(1)).not.toContain("disabled");
  expect(render(1, undefined, { pending: true })).toContain("disabled");
});
it("replaces confirmation with Delivered for a completed request", () => {
  const html = render(0, undefined, { request: { ...NPC_REQUESTS.brewer[0]!, slot: 0, completed: true } });
  expect(html).toContain("Delivered ✓");
  expect(html).not.toContain("<button");
});
