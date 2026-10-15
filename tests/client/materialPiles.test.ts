import { expect, it } from "vitest";
import { canStackMaterial } from "../../src/game-core/farm/materialPiles";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { isometricTilePopup } from "../../src/client/game/phaser/isometricTilePopup";
import { transferGroundItems } from "../../src/client/game/phaser/isometricPickup";
const id = "00000000-0000-4000-8000-000000000001";
it.each(["clay", "reed"])("allows only matching %s piles below five in the popup and rules", itemKey => {
  const cell = { column: 4, row: 2 };
  const snapshot = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
    farm: { id, playerId: id, version: 1, carriedItem: { itemKey, quantity: 1, expiresAt: null }, gathering: null,
      household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
    inventory: [], objects: [], crops: [], improvements: [], buildings: [],
    groundItems: [{ id, itemKey, quantity: 4, expiresAt: null, ...cell }] });
  expect(isometricTilePopup(snapshot, cell, 0).actions.drop).toBe(true);
  expect(isometricTilePopup(snapshot, cell, 0).actions.pickup).toBe(false);
  expect(isometricTilePopup(snapshot, cell, 0).actions.destroyMaterial).toBe(false);
  expect(isometricTilePopup(snapshot, cell, 0).details.some(detail => detail.startsWith("Carrying"))).toBe(false);
  expect(isometricTilePopup(snapshot, { column: 4, row: 6 }, 0).details.some(detail => detail.startsWith("Carrying"))).toBe(false);
  snapshot.groundItems[0]!.quantity = 5;
  expect(isometricTilePopup(snapshot, cell, 0).actions.drop).toBe(false);
  snapshot.groundItems[0]!.itemKey = itemKey === "clay" ? "reed" : "clay";
  snapshot.groundItems[0]!.quantity = 1;
  expect(isometricTilePopup(snapshot, cell, 0).actions.drop).toBe(false);
  expect(canStackMaterial("barley", { itemKey: "barley", quantity: 1 })).toBe(false);
  snapshot.farm.carriedItem = null;
  expect(isometricTilePopup(snapshot, cell, 0).actions.pickup).toBe(true);
  expect(isometricTilePopup(snapshot, cell, 0).actions.destroyMaterial).toBe(true);
});
it("preserves the previous pile during the drop animation", () => {
  const item = { id, itemKey: "clay" as const, quantity: 5, expiresAt: null, column: 4, row: 2 };
  expect(transferGroundItems([item], { type: "drop", item, path: [item], startedAt: 0, carried: 1 })[0]?.quantity).toBe(4);
  expect(transferGroundItems([item], null)[0]?.quantity).toBe(5);
});
