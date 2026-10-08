import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PorterPanel from "../../src/client/components/PorterPanel";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";

const render = (level: number, shekelBalance = 20) => {
  const snapshot = FarmSnapshotSchema.parse({
    created: false, player: { shekelBalance },
    farm: {
      id: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", version: 1,
      progression: { level, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
      household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
      carriedItem: null, gathering: null
    },
    inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: []
  });
  return renderToStaticMarkup(createElement(PorterPanel, { snapshot, now: Date.now() }));
};

describe("Porter management card", () => {
  it("uses the shared locked-card treatment and a spaced wrapper before level 5", () => {
    const html = render(1);
    expect(html).toContain('data-locked="true"');
    expect(html).toContain("porter-panel");
    expect(html).toContain('disabled=""');
    expect(html).toContain("Unlock at level 5");
  });
  it("restores the normal card when unlocked", () => {
    const html = render(5);
    expect(html).not.toContain("data-locked");
    expect(html).not.toContain('disabled=""');
    expect(html).toContain("Hire porter");
  });
  it("does not style an unlocked card as level-locked just because funds are low", () => {
    const html = render(5, 0);
    expect(html).not.toContain("data-locked");
    expect(html).toContain('disabled=""');
    expect(html).toContain("Not enough shekels");
  });
});
