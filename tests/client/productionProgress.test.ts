import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import ProductionProgress from "../../src/client/components/ProductionProgress";

const start = Date.parse("2026-10-19T12:00:00Z");
const job = { startedAt: new Date(start).toISOString(), completesAt: new Date(start + 180_000).toISOString(), output: 2 };

it.each([
  [-10_000, 0, "3m 10s"],
  [0, 0, "3m 0s"],
  [90_000, 50, "1m 30s"],
  [150_000, 83.33333333333334, "30s"],
  [180_000, 100, "0s"],
  [200_000, 100, "0s"],
])("samples the saved baking schedule at offset %i", (offset, percentage, countdown) => {
  const html = renderToStaticMarkup(createElement(ProductionProgress, { job, now: start + offset, label: "Baking progress" }));
  expect(html).toContain('aria-label="Baking progress"');
  expect(html).toContain(`value="${percentage}"`);
  expect(html).toContain(`${countdown} remaining`);
  expect(html).not.toContain("Baking bread");
});

it.each(["Milling progress", "Brewing progress"])("uses the identical countdown and bar for %s", label => {
  const html = renderToStaticMarkup(createElement(ProductionProgress, { job, now: start + 90_000, label }));
  expect(html).toContain(`aria-label="${label}"`);
  expect(html).toContain('value="50"');
  expect(html).toContain("1m 30s remaining");
});
