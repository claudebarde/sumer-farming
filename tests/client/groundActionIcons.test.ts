import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import BuildingActionIcon from "../../src/client/components/BuildingActionIcon";
import { readFileSync } from "node:fs";

it("places planting before irrigation in the isometric tile action list", () => {
  const source = readFileSync(new URL("../../src/client/components/IsometricTilePopup.tsx", import.meta.url), "utf8");
  expect(source.indexOf("<span>Plant barley</span>")).toBeLessThan(source.indexOf("<span>Build irrigation canal</span>"));
});

it.each([
  ["plantBarley", "plant-barley-icon.png"],
  ["harvestBarley", "harvest-barley-icon.png"],
  ["walk", "walk-here-icon.png"],
  ["irrigation", "canal-ne-sw.png"],
  ["road", "road-ne-sw.png"],
  ["emptyJars", "beer-jars-empty-isometric.png"],
  ["brewBeer", "brewing-beer-icon.png"],
  ["fish", "fish.png"],
  ["reed", "reed-bundle.png"],
  ["clay", "brick-pile.png"],
] as const)("uses the shared %s action artwork", (kind, filename) => {
  const html = renderToStaticMarkup(createElement(BuildingActionIcon, { kind }));
  expect(html).toContain(filename);
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('alt=""');
  expect(html.match(/<img /g)).toHaveLength(1);
});
