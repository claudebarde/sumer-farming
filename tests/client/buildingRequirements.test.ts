import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BuildingRequirements from "../../src/client/components/BuildingRequirements";
import { FarmSnapshotSchema } from "../../src/schemas/farm";

it("renders visual requirements with construction-eligible quantities and clamped progress", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const snapshot = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
    farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null,
      hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
      carriedItem: { itemKey: "clay", quantity: 1, expiresAt: null }, gathering: null },
    inventory: [{ itemKey: "reed", quantity: 2 }, { itemKey: "brewingVessels", quantity: 3 }],
    groundItems: [{ id, itemKey: "reed", quantity: 1, column: 0, row: 0, expiresAt: null }],
    objects: [], crops: [], improvements: [], buildings: [] });
  const html = renderToStaticMarkup(createElement(BuildingRequirements, { snapshot, building: "brewery" }));
  expect(html).toContain("Size: 2×2");
  expect(html).toContain("Building time: 3 minutes");
  expect(html).toContain("3/4");
  expect(html).toContain("0/6");
  expect(html).toContain("3/2");
  expect(html).toContain('value="3" max="4"');
  expect(html).toContain('value="0" max="6"');
  expect(html).toContain('value="2" max="2"');
  expect(html.match(/<progress/g)).toHaveLength(3);
  expect(html.match(/data-ready="true"/g)).toHaveLength(1);
  expect(html).toContain('aria-valuetext="3 of 2 available"');
});
