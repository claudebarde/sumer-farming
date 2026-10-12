import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../src/client/game/phaser/config", () => ({ TILE_SIZE: 64 }));
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { hasFarmerPopup } from "../../src/client/game/phaser/isometricTilePopup";
import IsometricTilePopup from "../../src/client/components/IsometricTilePopup";

const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
afterEach(() => vi.unstubAllGlobals());

it("only enables farmer hit-testing when his popup has barley content", () => {
  const farm = snapshot();
  expect(hasFarmerPopup(farm)).toBe(false);
  farm.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
  expect(hasFarmerPopup(farm)).toBe(true);
  farm.farm.carriedItem = { itemKey: "barley", quantity: 0, expiresAt: null };
  expect(hasFarmerPopup(farm)).toBe(false);
  farm.farm.carriedItem = { itemKey: "clay", quantity: 1, expiresAt: null };
  expect(hasFarmerPopup(farm)).toBe(false);
});

it("does not render a name-only popup from a stale farmer anchor after unloading", () => {
  vi.stubGlobal("window", { location: { href: "http://localhost/?view=isometric-farm" } });
  const noop = () => {};
  expect(renderToStaticMarkup(createElement(IsometricTilePopup, {
    snapshot: snapshot(), anchor: { kind: "farmer", cell: { column: 1, row: 5 }, x: 100, y: 100 }, now: 100,
    onClose: noop, onSelect: noop, onWalk: noop, onDrop: noop, onPickup: noop, onGather: noop,
    onBuildIrrigation: noop, onBuildRoad: noop, onStore: noop,
  }))).toBe("");
});
