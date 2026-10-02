import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, afterEach } from "vitest";
import { farmerCommandStore } from "../../src/client/stores/farmerCommandStore";
import FarmerPanel from "../../src/client/components/FarmerPanel";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";

const now = Date.parse("2026-09-29T12:00:00Z");
const render = (level: number, happiness = 70, quantity = 2, lastFishAt: string | null = null, item?: "bread" | "fish" | "beer", renderNow = now) => {
  const snapshot = FarmSnapshotSchema.parse({
    created: false, player: { shekelBalance: 0 },
    farm: {
      id: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", version: 1,
      progression: { level, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
      household: { happiness, lastBeerAt: item === "beer" ? lastFishAt : null, lastFishAt: !item || item === "fish" ? lastFishAt : null, lastBreadAt: item === "bread" ? lastFishAt : null, hungrySince: null,
        cultivationStartedAt: new Date(now).toISOString(), nextBarleyConsumptionAt: new Date(now + 3600000).toISOString() },
      carriedItem: null, gathering: null
    },
    inventory: [{ itemKey: "fish", quantity }, { itemKey: "beer", quantity }, { itemKey: "bread", quantity }],
    objects: [], groundItems: [], crops: [], improvements: [], buildings: []
  });
  return renderToStaticMarkup(createElement(FarmerPanel, { snapshot, now: renderNow }));
};

describe("Farmer management tab", () => {
  afterEach(() => vi.restoreAllMocks());
  it.each(["harvesting", "planting", "moving", "milling", "baking", "gathering", "building"] as const)("offers busy popovers for all treats while %s", type => {
    vi.spyOn(farmerCommandStore, "getInitialState").mockReturnValue({
      ...farmerCommandStore.getState(), status: { type, commandId: "test" }
    });
    const html = render(6);
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(3);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(3);
    // Busy triggers remain clickable to explain why the action is unavailable.
    expect(html).not.toContain('disabled=""');
  });
  it("labels empty fish stock without hiding an active cooldown", () => {
    expect(render(6, 70, 0)).toContain("No fish available");
    expect(render(6, 70, 0)).not.toContain("Give one fish to the farmer");
    const coolingDown = render(6, 70, 0, new Date(now - 3600000).toISOString());
    expect(coolingDown).toContain("Wait 7h 0m");
    expect(coolingDown).not.toContain("No fish available");
  });
  it.each([["fish", 8], ["bread", 12], ["beer", 24]] as const)("keeps the %s farmer cooldown visible with no stock", (item, hours) => {
    const html = render(6, 70, 0, new Date(now - 3600000).toISOString(), item);
    expect(html).toContain(`Wait ${hours - 1}h 0m`);
    expect(html).toContain('disabled=""');
    const later = render(6, 70, 1, new Date(now).toISOString(), item, now + hours * 3600000);
    expect(later).not.toContain("Wait");
    expect(later).not.toContain("disabled=");
  });
  it("offers bread for 15 happiness, while preserving level and stock restrictions", () => {
    expect(render(6, 70, 1, null, "bread")).toContain("+15 happiness");
    expect(render(6, 70, 1, null, "bread")).toContain("Give one bread to the farmer");
    expect(render(5, 70, 1, null, "bread")).toContain('disabled=""');
    expect(render(6, 70, 0, null, "bread")).toContain('disabled=""');
    expect(render(6, 100, 1, null, "bread")).toContain('disabled=""');
  });
  it.each([
    [0, "unhappy", "🙁"], [39, "unhappy", "🙁"],
    [40, "content", "🙂"], [69, "content", "🙂"],
    [70, "happy", "😄"], [100, "happy", "😄"]
  ] as const)("shows the mood smiley at happiness %i", (happiness, mood, smiley) => {
    const html = render(6, happiness);
    expect(html).toContain(`aria-label="Farmer mood: ${mood}"`);
    expect(html).toContain(smiley);
    expect(html.indexOf(smiley)).toBeLessThan(html.indexOf("Farmer happiness"));
    expect(html).not.toContain("<p>Mood:");
  });
  it("shows both meters and unlocked treat actions", () => {
    const html = render(6);
    expect(html).toContain('aria-label="Farmer happiness"');
    expect(html).toContain('aria-label="Time until next meal"');
    expect(html).toContain("Next meal");
    expect(html).toContain("Give one fish to the farmer");
    expect(html).toContain("Give one beer to the farmer");
    expect(html).not.toContain("disabled=");
  });
  it("locks fish and beer until their respective levels", () => {
    expect(render(3).match(/disabled=""/g)).toHaveLength(3);
    expect(render(4).match(/disabled=""/g)).toHaveLength(2);
    expect(render(3)).toContain("Unlocks at farm level 4.");
    expect(render(4)).toContain("Unlocks at farm level 6.");
  });
  it("disables treats with no stock or full happiness", () => {
    expect(render(6, 100).match(/disabled=""/g)).toHaveLength(3);
    expect(render(6, 70, 0).match(/disabled=""/g)).toHaveLength(3);
  });
  it("keeps cooldowns independent and updates the remaining time", () => {
    const html = render(6, 70, 2, new Date(now - 3600000).toISOString());
    expect(html).toContain("Wait 7h 0m");
    expect(html.match(/disabled=""/g)).toHaveLength(1);
  });
});
