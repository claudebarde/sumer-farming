import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BreadOvenContent from "../../src/client/components/BreadOvenContent";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";

const now = Date.parse("2026-09-30T12:00:00Z");
const buildingId = "00000000-0000-4000-8000-000000000003";
const render = (flour: number, level = 6, baking = false, constructionElapsed?: number) => {
  const snapshot = FarmSnapshotSchema.parse({
    created: false, player: { shekelBalance: 0 },
    farm: {
      id: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", version: 1,
      progression: { level, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
      household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null,
        cultivationStartedAt: new Date(now).toISOString(), nextBarleyConsumptionAt: new Date(now + 3600000).toISOString() },
      carriedItem: null, gathering: null,
      production: { pending: {}, delivery: null, baking: baking ? { [buildingId]: {
        startedAt: new Date(now - 150000).toISOString(), completesAt: new Date(now + 150000).toISOString(), output: 2
      } } : {} }
    },
    inventory: [{ itemKey: "flour", quantity: flour }], objects: [], groundItems: [], crops: [], improvements: [],
    buildings: [{ id: buildingId, type: "breadOven", column: 0, row: 4,
      startedAt: new Date(constructionElapsed === undefined ? 0 : now - constructionElapsed).toISOString(),
      completesAt: new Date(constructionElapsed === undefined ? 1 : now - constructionElapsed + 180000).toISOString(),
      storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0 }]
  });
  return renderToStaticMarkup(createElement(BreadOvenContent, {
    snapshot, buildingId, target: { column: 0, row: 4, posX: 0, posY: 256 }, now, addCommand: () => {}
  }));
};

describe("Bread Oven popup", () => {
  it("shows construction progress and remaining time before the disabled action", () => {
    const html = render(4, 6, false, 90000);
    expect(html).toContain("Construction: 1m 30s remaining.");
    expect(html).not.toContain("The oven is under construction.");
    expect(html).toContain('aria-label="Bread oven construction progress" max="100" value="50"');
    expect(html).toContain('disabled=""');
    expect(html.indexOf("</progress>")).toBeLessThan(html.indexOf("<button"));
  });
  it("updates the countdown and removes construction progress on completion", () => {
    expect(render(4, 6, false, 150000)).toContain("Construction: 0m 30s remaining.");
    expect(render(4, 6, false, 180000)).not.toContain("construction progress");
    expect(render(4, 6, false, 180000)).not.toContain("disabled=");
  });
  it("shows the recipe and delivery instructions before an enabled action", () => {
    const html = render(2);
    expect(html).toContain("2 Flour → 2 Bread · 5 minutes");
    expect(html).toContain("until delivered to the farm");
    expect(html).not.toContain("disabled=");
    expect(html.lastIndexOf("</p>")).toBeLessThan(html.indexOf("<button"));
  });
  it("explains missing Flour instead of implying a level lock", () => {
    expect(render(1)).toContain("Store more Flour before baking.");
    expect(render(1)).toContain('disabled=""');
  });
  it("locks baking below level 6", () => {
    expect(render(2, 5)).toContain("Unlock at level 6.");
    expect(render(2, 5)).toContain('disabled=""');
  });
  it("shows the remaining timer and progress and prevents duplicate jobs", () => {
    const html = render(4, 6, true);
    expect(html).toContain("150 seconds remaining.");
    expect(html).toContain('aria-label="Baking progress" max="100" value="50"');
    expect(html).toContain('disabled=""');
  });
});
