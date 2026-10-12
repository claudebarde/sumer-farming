import { expect, it } from "vitest";
import { storageChipBounce, updateStorageChip } from "../../src/client/game/phaser/storageChipBounce";

it("does not bounce on first load, unchanged stock or decreases", () => {
  const initial = updateStorageChip(undefined, 5, 1000);
  expect(initial.increasedAt).toBeNull();
  expect(updateStorageChip(initial, 5, 2000).increasedAt).toBeNull();
  expect(updateStorageChip(initial, 4, 2000).increasedAt).toBeNull();
});
it("bounces when stock increases, including a previously hidden zero chip", () => {
  const empty = updateStorageChip(undefined, 0, 1000);
  const filled = updateStorageChip(empty, 2, 2000);
  expect(filled.increasedAt).toBe(2000);
  expect(updateStorageChip(filled, 2, 2100).increasedAt).toBe(2000);
  expect(updateStorageChip(filled, 4, 2200).increasedAt).toBe(2200);
});
it("lifts, grows, settles and respects reduced motion and elapsed time", () => {
  expect(storageChipBounce(1000, 1105).scale).toBeGreaterThan(1);
  expect(storageChipBounce(1000, 1105).offsetY).toBeLessThan(0);
  expect(storageChipBounce(1000, 1315).scale).toBeLessThan(1);
  for (const now of [1420, 10000]) expect(storageChipBounce(1000, now)).toEqual({ scale: 1, offsetY: 0 });
  expect(storageChipBounce(1000, 1105, true)).toEqual({ scale: 1, offsetY: 0 });
  expect(storageChipBounce(null, 1105)).toEqual({ scale: 1, offsetY: 0 });
});
