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

const render = (s: ReturnType<typeof snapshot>) => renderToStaticMarkup(
  createElement(IsometricBuildingCatalogue, { snapshot: s, now: 0, onBuild: () => {} })
);
const atLevel = (level: number) => {
  const s = snapshot();
  s.farm.progression = { level, breadSold: 0, barleySold: 0, beerSold: 0, requestsDelivered: 0,
    stats: { breadProduced: 0, processedBarley: 0, harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0 } };
  return s;
};

it("opens Already built when no buildings are available, even before the first unlock", () => {
  const html = render(snapshot());
  expect(html).toContain("Available (0)");
  expect(html).toContain("Already built (0)");
  expect(html).toContain("Future unlocks (6)");
  expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(2);
  expect(html).toContain("No buildings built yet.");
  expect(html).not.toContain("No buildings available.");
  expect(html).not.toContain('alt="Mill"');
});

it("enables warehouse construction at level 8 with materials instead of a coming-soon placeholder", () => {
  const s = atLevel(8);
  s.inventory = [{ itemKey: "reed", quantity: 4 }, { itemKey: "clay", quantity: 6 }];
  const html = render(s);
  expect(html).toMatch(/<button>Build Warehouse<\/button>/);
  expect(html).not.toContain("Construction coming soon.");
  s.inventory = [];
  expect(render(s)).toMatch(/<button disabled="">Build Warehouse<\/button>/);
});

it("opens Already built after all currently unlocked buildings have been built", () => {
  const s = atLevel(6);
  s.buildings = FarmSnapshotSchema.parse({ ...s, buildings:
    ["granary", "mill", "brewery", "breadOven"].map((type, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i + 2}`, type, column: i * 3, row: 3,
      storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0,
      beerReadyAt: null, beerServed: 0, loadingTile: { column: i * 3, row: 5 },
      startedAt: new Date(0).toISOString(), completesAt: new Date(120000).toISOString()
    })) }).buildings;
  const html = render(s);
  expect(html).toContain("Available (0)");
  expect(html).toContain("Already built (4)");
  expect(html).toContain('<h3>Brewery</h3>');
  expect(html).not.toContain("No buildings available.");
  expect(html).not.toContain('<h3>Warehouse</h3>');
  expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
});

it("keeps unlocked buildings available when materials are missing", () => {
  const html = render(atLevel(6));
  expect(html).toContain("Available (4)");
  expect(html).toContain("Future unlocks (2)");
  expect(html).toContain("brewery-isometric.webp");
  expect(html).toContain("bread-oven-isometric.webp");
  expect(html).toContain('aria-label="Brewing jars"');
  expect(html).toContain('aria-label="Baking tools"');
  expect(html).toContain("Building time: 3 minutes");
  expect(html).toContain("Build brewery");
  expect(html).not.toContain('alt="Warehouse"');
  expect(html).not.toContain("Gather ");
  expect(html.match(/<button disabled=""/g)).toHaveLength(4);
});

it("omits equipment-shortage reminders but preserves farmer status", () => {
  const s = atLevel(6);
  s.inventory = [{ itemKey: "reed", quantity: 10 }, { itemKey: "clay", quantity: 10 }];
  const html = render(s);
  expect(html).not.toContain("Buy 2 brewing jars at the beer market.");
  expect(html).not.toContain("Buy 2 baking tools at the baking market.");
  expect(html).toContain('aria-label="Brewing jars"');
  s.farm.carriedItem = { itemKey: "clay", quantity: 1, expiresAt: null };
  expect(render(s)).toContain("Empty the farmer’s hands first.");
});

it("groups existing buildings, including construction sites, outside Available", () => {
  const s = atLevel(6);
  s.buildings = FarmSnapshotSchema.parse({ ...s, buildings: [{
    id: s.farm.id, type: "mill", column: 4, row: 3, storedBarley: 0,
    brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
    loadingTile: { column: 4, row: 5 }, startedAt: new Date(0).toISOString(), completesAt: new Date(120000).toISOString()
  }] }).buildings;
  const html = render(s);
  expect(html).toContain("Available (3)");
  expect(html).toContain("Already built (1)");
  expect(html).not.toContain('alt="Mill"');
  s.buildings = [];
  expect(render(s)).toContain("Available (4)");
});

it("shows all unlocked building cards with their original artwork and descriptions", () => {
  const html = render(atLevel(8));
  expect(html).toContain("Available (6)");
  expect(html).toContain("Future unlocks (0)");
  expect(html.match(/width="160" height="160"/g)).toHaveLength(6);
  expect(html).toContain("The farmer is occupied during milling.");
  expect(html).toContain("Turn Flour into bread.");
  expect(html).toContain("warehouse-isometric.webp");
  expect(html).toContain("small-shrine-isometric.webp");
  expect(html).not.toContain("Construction coming soon.");
});
