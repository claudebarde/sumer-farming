import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { FarmSnapshot } from "../../src/schemas/farm";
import BarleyGrowthProgress from "../../src/client/components/BarleyGrowthProgress";

const crop: FarmSnapshot["crops"][number] = {
  id: "00000000-0000-4000-8000-000000000001", cropKey: "barley", column: 4, row: 8,
  sowingStartedAt: new Date(0).toISOString(), plantedAt: new Date(10000).toISOString(),
  growthCompletesAt: new Date(1810000).toISOString(), harvestStartedAt: null, harvestCompletesAt: null
};
const render = (now: number, value = crop) => renderToStaticMarkup(createElement(BarleyGrowthProgress, { crop: value, now }));
it("shows saved growth progress with the palm-style percentage and countdown", () => {
  expect(render(910000)).toContain('value="50"');
  expect(render(910000)).toContain("15m remaining");
  expect(render(910000)).not.toContain("0h ");
  expect(render(910000)).toContain('aria-label="Barley growth"');
  expect(render(910000)).toContain("The barley is growing");
  expect(render(10000)).toContain('value="0"');
});
it("leaves planting, ripe and harvesting states unchanged", () => {
  expect(render(0)).toBe("");
  expect(render(1810000)).toBe("");
  expect(render(910000, { ...crop, harvestCompletesAt: new Date(2000000).toISOString() })).toBe("");
});
