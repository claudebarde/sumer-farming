import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { gatherableResource, gatheringOffsetY, gatheringPath, gatheringPose } from "../../src/client/game/phaser/isometricGathering";
import { isometricTilePopup } from "../../src/client/game/phaser/isometricTilePopup";
const id = "00000000-0000-4000-8000-000000000001";
it("applies the ground-item position only to stationary clay collection", () => {
  expect(gatheringOffsetY("clay", false)).toBe(14);
  expect(gatheringOffsetY("clay", true)).toBe(0);
  expect(gatheringOffsetY("reed", false)).toBe(0);
  expect(gatheringOffsetY("reed", true)).toBe(0);
});
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [{ id, type: "reeds", column: 3, row: 9 }], groundItems: [], crops: [], improvements: [], buildings: [] });

it("offers reeds on sources and clay only on empty accessible riverbank", () => {
  const s = snapshot();
  expect(gatherableResource(s, { column: 3, row: 9 }, 1000)).toBe("reed");
  expect(gatherableResource(s, { column: 4, row: 9 }, 1000)).toBe("clay");
  expect(gatherableResource(s, { column: 4, row: 11 }, 1000)).toBeNull();
  expect(gatherableResource(s, { column: 4, row: 8 }, 1000)).toBeNull();
  s.inventory = [{ itemKey: "reed", quantity: 6 }];
  expect(gatherableResource(s, { column: 3, row: 9 }, 1000)).toBeNull();
});
it.each(["reed", "clay"] as const)("permits dropping and picking up %s without allowing new work", itemKey => {
  const s = snapshot(), cell = { column: 4, row: 7 };
  s.farm.carriedItem = { itemKey, quantity: 1, expiresAt: null };
  expect(isometricTilePopup(s, cell, 1000).actions).toMatchObject({ drop: true, walk: true, gather: null, plant: false });
  s.farm.carriedItem = null;
  s.groundItems = [{ id, ...cell, itemKey, quantity: 1, expiresAt: null }];
  expect(isometricTilePopup(s, cell, 1000).actions.pickup).toBe(true);
  s.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
  expect(isometricTilePopup(s, cell, 1000).actions.pickup).toBe(false);
});
it.each(["reed", "clay"] as const)("walks onto the %s source, works there and resumes on the same tile", itemKey => {
  const s = snapshot(), target = { column: itemKey === "reed" ? 3 : 4, row: 9 };
  const path = gatheringPath(s, { column: 3, row: 5 }, target, 1000)!;
  expect(path.at(-1)).toEqual(target);
  s.farm.gathering = { itemKey, target, startedAt: new Date(1000).toISOString(), completesAt: new Date(11000).toISOString() };
  expect(gatheringPose(s, 1100, { path, startedAt: 1000 })?.walking).toBe(true);
  expect(gatheringPose(s, 5000, { path, startedAt: 1000 })).toMatchObject({ walking: false, itemKey, position: target });
  expect(gatheringPose(s, 5000)).toMatchObject({ walking: false, position: target });
  s.farm.gathering = null;
  expect(gatheringPose(s, 50000)).toBeNull();
});

it("does not allow gathering paths through rocks or unrelated reeds", () => {
  const s = snapshot();
  s.objects.push({ id, type: "rock", column: 4, row: 9 });
  expect(gatheringPath(s, { column: 3, row: 5 }, { column: 4, row: 9 }, 1000)).toBeNull();
  const path = gatheringPath(s, { column: 3, row: 5 }, { column: 5, row: 9 }, 1000)!;
  expect(path).not.toContainEqual({ column: 3, row: 9 });
});
