import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { pickupDuration, pickupPath, pickupPose, transferGroundItems, type GroundTransfer } from "../../src/client/game/phaser/isometricPickup";

const path = [{ column: 3, row: 5 }, { column: 4, row: 5 }, { column: 4, row: 6 }];
describe("isometric pickup presentation", () => {
  it("hides only the newly dropped bundle until placement, preserving other piles and the snapshot", () => {
    const item = { id: "drop", ...path[2]!, itemKey: "barley" as const, quantity: 1, expiresAt: null };
    const other = { ...item, id: "other", column: 7 };
    const items = [item, other];
    for (const carried of [1, 2]) {
      const transfer: GroundTransfer = { type: "drop", path, startedAt: 1000, item, carried };
      expect(transferGroundItems(items, transfer)).toEqual([other]);
      expect(transfer.carried).toBe(carried);
      expect(pickupPose(path, 1000, 1959).done).toBe(false);
      expect(pickupPose(path, 1000, 1960).done).toBe(true);
      expect(transferGroundItems(items, null)).toEqual([item, other]);
    }
    expect(items).toEqual([item, other]);
  });
  it("retains the original pickup pile until collection without duplicating its remainder", () => {
    const item = { id: "pickup", ...path[2]!, itemKey: "barley" as const, quantity: 2, expiresAt: null };
    const remaining = [{ ...item, quantity: 1 }];
    expect(transferGroundItems(remaining, { type: "pickup", path, startedAt: 1000, item, carried: 0 })).toEqual([item]);
    expect(transferGroundItems(remaining, null)).toEqual(remaining);
  });
  it("walks at 180ms per tile before reaching down", () => {
    expect(pickupDuration(path)).toBe(960);
    expect(pickupPose(path, 1000, 1090)).toMatchObject({ walking: true, position: { column: 3.5, row: 5 }, dip: 0, done: false });
    expect(pickupPose(path, 1000, 1360)).toMatchObject({ walking: false, position: path[2], done: false });
    expect(pickupPose(path, 1000, 1660).dip).toBeCloseTo(5);
    expect(pickupPose(path, 1000, 1959).done).toBe(false);
    expect(pickupPose(path, 1000, 1960).done).toBe(true);
  });
  it("catches up after absence without replaying travel", () => {
    expect(pickupPose(path, 1000, 100000)).toMatchObject({ done: true, position: path[2], walking: false });
  });
  it("handles pickup on the current tile without walking or invalid numbers", () => {
    const here = [path[0]!];
    expect(pickupDuration(here)).toBe(600);
    expect(pickupPose(here, 1000, 1000)).toMatchObject({ distance: 0, walking: false, dip: 0, done: false });
    expect(pickupPose(here, 1000, 1600).done).toBe(true);
  });
  it("routes around buildings and rejects an unreachable target", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const snapshot = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
      farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
        household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
      inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
    expect(pickupPath(snapshot, path[0]!, path[2]!, 1000)).toEqual(path);
    expect(pickupPath(snapshot, path[0]!, { column: 1, row: 3 }, 1000)).toBeNull();
    expect(pickupPath(snapshot, path[0]!, { column: 3, row: 10 }, 1000)).toBeNull();
    const around = pickupPath(snapshot, { column: 0, row: 3 }, { column: 3, row: 3 }, 1000)!;
    expect(around.length).toBeGreaterThan(4);
    expect(around.some(p => (p.column === 1 || p.column === 2) && (p.row === 3 || p.row === 4))).toBe(false);
  });
});
