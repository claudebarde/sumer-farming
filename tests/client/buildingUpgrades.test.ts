import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { activeBuildingUpgrade, buildingLevel, BUILDING_UPGRADES, type BuildingUpgrades } from "../../src/game-data/buildingUpgrades";
import { millRecipe } from "../../src/game-data/milling";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import MillContent from "../../src/client/components/MillContent";
import { TileActionsBusy } from "../../src/client/components/tileActionsBusy";
import BreadOvenContent from "../../src/client/components/BreadOvenContent";
import BuildingUpgradeContent from "../../src/client/components/BuildingUpgradeContent";

const id = "00000000-0000-4000-8000-000000000003";
const start = Date.parse("2026-10-04T12:00:00Z");
const upgrades: BuildingUpgrades = { [id]: [{ level: 2, startedAt: new Date(start).toISOString(), completesAt: new Date(start + 300000).toISOString(), idempotencyKey: "00000000-0000-4000-8000-000000000004" }] };
const render = (history: BuildingUpgrades | undefined, now: number, balance = 100, busy = false, type: "mill" | "breadOven" | "brewery" = "mill", estateLevel = 8) => {
  const snapshot = FarmSnapshotSchema.parse({
    created: false, player: { shekelBalance: balance },
    farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
      progression: { level: estateLevel, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
      household: { happiness: 70, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
      production: { pending: {}, delivery: null, baking: {}, buildingUpgrades: history }
    },
    inventory: [{ itemKey: "barley", quantity: 6 }, { itemKey: "donkey", quantity: 1 }],
    objects: [], groundItems: [], crops: [], improvements: [],
    buildings: [{ id, type, column: 3, row: 3, storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
      startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString() }]
  });
  const content = type === "brewery" ? createElement(BuildingUpgradeContent, { buildingId: id, snapshot, now, children: createElement("p", null, "Brewing controls") })
    : createElement(type === "mill" ? MillContent : BreadOvenContent, { buildingId: id, snapshot,
      target: { column: 3, row: 3, posX: 192, posY: 192 }, now, addCommand: () => {} });
  return renderToStaticMarkup(createElement(TileActionsBusy.Provider, { value: busy }, content));
};

describe("building upgrade configuration and display", () => {
  it.each([
    ["mill", 2, 8], ["mill", 3, 10], ["breadOven", 2, 9], ["breadOven", 3, 11], ["brewery", 2, 9], ["brewery", 3, 11]
  ] as const)("shows the %s level %s unlock at estate level %s", (type, target, required) => {
    const history = target === 3 ? upgrades : undefined;
    const locked = render(history, start + 300000, 500, false, type, required - 1);
    expect(locked).toContain(`<button disabled="">Level ${target} · Unlock at estate level ${required}`);
    const available = render(history, start + 300000, 500, false, type, required);
    expect(available).toContain(`<button>Upgrade to level ${target} · ${target === 2 ? 100 : 200} shekels`);
  });
  it.each(["breadOven", "brewery"] as const)("shows %s upgrade progress instead of production controls and keeps busy buttons hidden", type => {
    const html = render(upgrades, start + 150000, 500, false, type, 9);
    expect(html).toContain('aria-label="Building upgrade progress" max="100" value="50"');
    expect(html).toContain("2m 30s remaining");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Brewing controls");
    expect(html).not.toContain("Bake bread");
    expect(render(undefined, start, 500, true, type, 11)).not.toContain("<button");
  });
  it("shows the shorter baking recipe after upgrading", () => {
    expect(render(upgrades, start + 300000, 500, false, "breadOven", 9)).toContain("4m 15s");
  });
  it("defaults legacy saves to level 1 and completes exactly at the deadline", () => {
    expect(buildingLevel(undefined, id, start)).toBe(1);
    expect(buildingLevel(upgrades, id, start + 299999)).toBe(1);
    expect(activeBuildingUpgrade(upgrades, id, start + 299999)).toBeDefined();
    expect(buildingLevel(upgrades, id, start + 300000)).toBe(2);
    expect(activeBuildingUpgrade(upgrades, id, start + 300000)).toBeUndefined();
    expect(buildingLevel(upgrades, "another-building", start + 300000)).toBe(1);
  });
  it.each(["flour", "brewersGroats"] as const)("reduces %s recipe time without changing inputs or output", recipe => {
    for (const worker of ["farmer", "donkey"] as const) {
      const base = millRecipe(recipe, worker);
      for (const level of [2, 3]) {
        const upgraded = millRecipe(recipe, worker, level);
        expect(upgraded.barley).toBe(base.barley);
        expect(upgraded.output).toBe(base.output);
        expect(upgraded.durationMs).toBe(base.durationMs * (level === 2 ? 0.85 : 0.7));
      }
    }
    expect(BUILDING_UPGRADES.mill?.[2]?.cost).toBe(100);
    expect(BUILDING_UPGRADES.mill?.[3]?.cost).toBe(200);
    expect(BUILDING_UPGRADES.warehouse).toBeUndefined();
  });
  it("shows the current level and disables an unaffordable upgrade", () => {
    const html = render(undefined, start, 99);
    expect(html).toContain('aria-label="Building level 1"');
    expect(html).toContain("Not enough shekels");
    expect(html).toMatch(/<button disabled="">Upgrade to level 2 · 100 shekels/);
    expect(render(undefined, start, 100)).toContain("<button>Upgrade to level 2 · 100 shekels");
  });
  it("replaces production controls with progress during the upgrade", () => {
    const html = render(upgrades, start + 150000);
    expect(html).toContain("Upgrading to level 2");
    expect(html).toContain('aria-label="Building upgrade progress" max="100" value="50"');
    expect(html).toContain("2m 30s remaining");
    expect(html).not.toContain("<button");
    expect(html).not.toContain('role="combobox"');
  });
  it("shows the upgraded recipes after the deadline without requiring reload", () => {
    const html = render(upgrades, start + 300000, 200);
    expect(html).toContain('aria-label="Building level 2"');
    expect(html).toContain("4m 15s");
    expect(html).toContain("12m 45s");
    expect(html).toContain("Level 3 · Unlock at estate level 10");
    expect(html).not.toContain("Building upgrade progress");
  });
  it("keeps buttons hidden while the farmer is busy", () => {
    expect(render(undefined, start, 200, true)).not.toContain("<button");
  });
});
