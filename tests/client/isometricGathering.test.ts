import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { gatherableResource, gatheringOffsetY, gatheringPath, gatheringPose } from "../../src/client/game/phaser/isometricGathering";
import { isometricTilePopup } from "../../src/client/game/phaser/isometricTilePopup";
import { isoPoint } from "../../src/client/game/phaser/isometricProjection";
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

it("offers reeds on sources and clay only on empty non-arable accessible riverbank", () => {
  const s = snapshot();
  expect(gatherableResource(s, { column: 3, row: 9 }, 1000)).toBe("reed");
  expect(gatherableResource(s, { column: -1, row: 9 }, 1000)).toBe("clay");
  expect(gatherableResource(s, { column: 8, row: 9 }, 1000)).toBe("clay");
  expect(gatherableResource(s, { column: 4, row: 11 }, 1000)).toBeNull();
  expect(gatherableResource(s, { column: 4, row: 8 }, 1000)).toBeNull();
  s.inventory = [{ itemKey: "reed", quantity: 6 }];
  expect(gatherableResource(s, { column: 3, row: 9 }, 1000)).toBeNull();
});
it("omits the clay action on every arable riverbank tile", () => {
  const s = snapshot();
  s.objects = [];
  for (let column = 0; column <= 7; column++) {
    const cell = { column, row: 9 };
    expect(gatherableResource(s, cell, 1000)).toBeNull();
    expect(isometricTilePopup(s, cell, 1000).actions.gather).toBeNull();
  }
  expect(isometricTilePopup(s, { column: -1, row: 9 }, 1000).actions.gather).toBe("clay");
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
it.each(["reed", "clay"] as const)("offers %s drops on empty land, not water, roads, buildings or occupied cells", itemKey => {
  const s = snapshot();
  s.farm.carriedItem = { itemKey, quantity: 1, expiresAt: null };
  for (const cell of [{ column: -2, row: 2 }, { column: 4, row: 7 }, { column: 4, row: 13 }]) {
    expect(isometricTilePopup(s, cell, 1000).actions.drop).toBe(true);
  }
  for (const cell of [{ column: 4, row: 10 }, { column: 4, row: 11 }, { column: 4, row: 5 },
    { column: 1, row: 3 }, { column: 11, row: 3 }, { column: -5, row: 2 }, { column: 3, row: 9 }]) {
    expect(isometricTilePopup(s, cell, 1000).actions.drop).toBe(false);
  }
  s.groundItems = [{ id, column: -2, row: 2, itemKey, quantity: 1, expiresAt: null }];
  expect(isometricTilePopup(s, { column: -2, row: 2 }, 1000).actions.drop).toBe(true);
  s.groundItems[0]!.quantity = 5;
  expect(isometricTilePopup(s, { column: -2, row: 2 }, 1000).actions.drop).toBe(false);
  s.groundItems = [];
  s.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
  expect(isometricTilePopup(s, { column: -2, row: 2 }, 1000).actions.drop).toBe(false);
});
it.each(["reed", "clay"] as const)("offers destruction for a selected dropped %s pile only", itemKey => {
  const s = snapshot(), cell = { column: -2, row: 2 };
  s.groundItems = [{ id, ...cell, itemKey, quantity: 2, expiresAt: null }];
  expect(isometricTilePopup(s, cell, 1000).actions.destroyMaterial).toBe(true);
  expect(isometricTilePopup(s, { column: -1, row: 2 }, 1000).actions.destroyMaterial).toBe(false);
  expect(isometricTilePopup(s, { column: 3, row: 9 }, 1000).actions.destroyMaterial).toBe(false);
  s.groundItems[0]!.itemKey = "barley";
  expect(isometricTilePopup(s, cell, 1000).actions.destroyMaterial).toBe(false);
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

it("approaches reeds from upper-right and keeps the working farmer behind the patch", () => {
  const s = snapshot(), target = { column: 3, row: 9 };
  const path = gatheringPath(s, { column: 3, row: 5 }, target, 1000)!;
  expect(path.at(-2)).toEqual({ column: 3, row: 8 });
  s.farm.gathering = { itemKey: "reed", target, startedAt: new Date(1000).toISOString(), completesAt: new Date(11000).toISOString() };
  const source = isoPoint(target);
  for (const approach of [{ path, startedAt: 1000 }, undefined]) {
    const pose = gatheringPose(s, 5000, approach)!;
    const point = isoPoint(pose.visualPosition);
    expect(point).toEqual({ x: source.x + 18, y: source.y - 9 });
    expect(point.y + 1).toBeLessThan(source.y); // reed sprite depth
    expect(pose.facingLeft).toBe(true);
    expect(pose.position).toEqual(target); // routing stays on integer tiles
  }
  const arrival = 1000 + (path.length - 1) * 180;
  const before = isoPoint(gatheringPose(s, arrival - 1, { path, startedAt: 1000 })!.visualPosition);
  const after = isoPoint(gatheringPose(s, arrival, { path, startedAt: 1000 })!.visualPosition);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
});
