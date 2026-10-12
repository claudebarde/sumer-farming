import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import IsometricBuildingCatalogue from "../../src/client/components/IsometricBuildingCatalogue";

const snapshot = () =>
  FarmSnapshotSchema.parse({
    created: false,
    player: { shekelBalance: 0 },
    farm: {
      id: "00000000-0000-4000-8000-000000000001",
      playerId: "00000000-0000-4000-8000-000000000001",
      version: 1,
      household: {
        happiness: 70,
        lastBeerAt: null,
        lastFishAt: null,
        hungrySince: null,
        cultivationStartedAt: null,
        nextBarleyConsumptionAt: null
      },
      carriedItem: null,
      gathering: null
    },
    inventory: [],
    objects: [],
    groundItems: [],
    crops: [],
    improvements: [],
    buildings: []
  });

it("shows all six isometric buildings with the original descriptions and unlock labels", () => {
  const html = renderToStaticMarkup(
    createElement(IsometricBuildingCatalogue, { snapshot: snapshot(), now: 0 })
  );
  expect(html).toContain("granary-isometric-test.png");
  expect(html).toContain("mill-isometric.png");
  expect(html).toContain("brewery-isometric.png");
  expect(html).toContain("bread-oven-isometric.png");
  expect(html).toContain("warehouse-isometric.png");
  expect(html).toContain("small-shrine-isometric.png");
  expect(html.match(/width="160" height="160"/g)).toHaveLength(6);
  expect(html).toContain("Store and protect up to 15 additional barley.");
  expect(html).toContain("The farmer is occupied during milling.");
  expect(html).toContain("Unlock at level 2");
  expect(html).toContain("Unlock at level 5");
  expect(html).toContain("Unlock at level 6");
  expect(html).toContain("0/2 brewing jars");
  expect(html).toContain("Brew beer to trade or give the farmer as a happiness treat.");
  expect(html).toContain("0/2 baking tools");
  expect(html).toContain("Turn Flour into bread.");
  expect(html.match(/Unlock at level 6/g)).toHaveLength(2);
  expect(html.match(/Unlock at level 8/g)).toHaveLength(2);
  expect(html).toContain("1×1 · 2 minutes · 0/2 reed · 0/4 clay");
  expect(html).toContain("Offer 2 bread or 2 beer to slow happiness decay by 25% for 12 hours. One shrine per farm.");
  expect(html).toContain("Stores 20 barley. Adds 10 storage each for bread, beer, flour, groats, reed and clay.");
  expect(html.match(/<button disabled=""/g)).toHaveLength(6);
  expect(html).toContain("Other building placement coming soon.");
});
