import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../src/client/game/phaser/config", () => ({ TILE_SIZE: 64 }));
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { hasFarmerPopup, isometricTilePopup } from "../../src/client/game/phaser/isometricTilePopup";
import FarmerPopupStatus from "../../src/client/components/FarmerPopupStatus";
import { farmerActivity } from "../../src/client/game/phaser/farmerActivity";

const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
afterEach(() => vi.unstubAllGlobals());

it.each(["mill", "breadOven", "brewery"] as const)("shows level 1 on the %s building", type => {
  const farm = snapshot();
  farm.buildings.push({ id, type, column: 5, row: 3, storedBarley: 0, brewingBarley: 0,
    brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
    startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString(), loadingTile: { column: 5, row: 5 } });
  expect(isometricTilePopup(farm, { column: 5, row: 3 }, 1000).level).toBe(1);
});

it("keeps household status available regardless of carried goods", () => {
  const farm = snapshot();
  expect(hasFarmerPopup(farm)).toBe(true);
  farm.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
  expect(hasFarmerPopup(farm)).toBe(true);
  farm.farm.carriedItem = { itemKey: "barley", quantity: 0, expiresAt: null };
  expect(hasFarmerPopup(farm)).toBe(true);
  farm.farm.carriedItem = { itemKey: "clay", quantity: 1, expiresAt: null };
  expect(hasFarmerPopup(farm)).toBe(true);
});

it("renders the shared happiness and meal meters with empty hands", () => {
  const farm = snapshot();
  farm.farm.household.nextBarleyConsumptionAt = new Date(3600000).toISOString();
  const html = renderToStaticMarkup(createElement(FarmerPopupStatus, { snapshot: farm, now: 0 }));
  expect(html).not.toContain("head-and-shoulders portrait");
  expect(html).toContain("Idle");
  expect(html).toContain('alt="stool"');
  expect(html.indexOf("Idle")).toBeLessThan(html.indexOf("Happiness"));
  expect(html.indexOf("Happiness")).toBeLessThan(html.indexOf("Next meal"));
  expect(html).toContain('aria-label="Farmer happiness"');
  expect(html).toContain('aria-valuenow="70"');
  expect(html).toContain("Next meal in 1 hours and 0 minutes");
  farm.farm.household.hungrySince = new Date(0).toISOString();
  expect(renderToStaticMarkup(createElement(FarmerPopupStatus, { snapshot: farm, now: 0 }))).toContain("Hungry: a meal is needed now");
});

it("shows carrying in the activity column and prioritizes current work", () => {
  const s = snapshot();
  s.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
  expect(farmerActivity(s, 0)).toMatchObject({ label: "Carrying", item: "barley", quantity: 2 });
  expect(farmerActivity(s, 0, true).label).toBe("Walking");
  s.farm.milling = { buildingId: id, recipe: "flour", barley: 2, output: 1, startedAt: new Date(1000).toISOString(), completesAt: new Date(301000).toISOString() };
  expect(farmerActivity(s, 0)).toMatchObject({ label: "Collecting", item: "barley" });
  expect(farmerActivity(s, 2000)).toMatchObject({ label: "Milling", item: "flour" });
  const html = renderToStaticMarkup(createElement(FarmerPopupStatus, { snapshot: s, now: 2000 }));
  expect(html).toContain('alt="flour"');
  expect(html).toContain("Milling");
  expect(html).not.toContain(">Activity<");
});

it("uses the corresponding collected material icon", () => {
  const s = snapshot();
  for (const itemKey of ["clay", "reed"] as const) {
    s.farm.gathering = { itemKey, target: { column: 1, row: 1 }, startedAt: new Date(0).toISOString(), completesAt: new Date(2000).toISOString() };
    expect(farmerActivity(s, 1000)).toMatchObject({ label: "Collecting", item: itemKey });
  }
});

it.each([false, true])("shows the water icon without a cuneiform overlay while carrying (walking=%s)", walking => {
  const s = snapshot();
  s.farm.carriedItem = { itemKey: "water", quantity: 1, expiresAt: null };
  expect(farmerActivity(s, 0, walking)).toMatchObject({ item: "water", quantity: 1 });
  const html = renderToStaticMarkup(createElement(FarmerPopupStatus, { snapshot: s, now: 0, walking }));
  expect(html).toContain('alt="water"');
  expect(html).toContain("water.webp");
  expect(html).not.toContain("𒀀");
});

it("shows the pickaxe during building construction and the stool after completion", () => {
  const s = snapshot();
  s.buildings = [{ id, type: "mill", column: 4, row: 3, storedBarley: 0, brewingBarley: 0,
    brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0, loadingTile: null,
    startedAt: new Date(0).toISOString(), completesAt: new Date(2000).toISOString() }];
  expect(farmerActivity(s, 1000)).toMatchObject({ label: "Building", item: "pickaxe" });
  const html = renderToStaticMarkup(createElement(FarmerPopupStatus, { snapshot: s, now: 1000 }));
  expect(html).toContain('alt="pickaxe"');
  expect(html).toContain(">Building<");
  expect(farmerActivity(s, 2000)).toMatchObject({ label: "Idle", item: "stool" });
});
