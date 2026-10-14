import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../src/client/game/phaser/config", () => ({ TILE_SIZE: 64 }));
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { hasFarmerPopup } from "../../src/client/game/phaser/isometricTilePopup";
import FarmerPopupStatus from "../../src/client/components/FarmerPopupStatus";

const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
afterEach(() => vi.unstubAllGlobals());

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
  expect(html).toContain('aria-label="Farmer happiness"');
  expect(html).toContain('aria-valuenow="70"');
  expect(html).toContain("Next meal in 1 hours and 0 minutes");
  farm.farm.household.hungrySince = new Date(0).toISOString();
  expect(renderToStaticMarkup(createElement(FarmerPopupStatus, { snapshot: farm, now: 0 }))).toContain("Hungry: a meal is needed now");
});
