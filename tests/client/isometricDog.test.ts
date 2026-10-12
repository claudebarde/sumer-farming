import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { DOG_SOURCES, initialDog, stepDog, dogTexture, dogClear } from "../../src/client/game/phaser/isometricDog";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
it("loads exactly six walking frames and a sitting frame, not the contact sheet", () => {
  expect(Object.keys(DOG_SOURCES).sort()).toEqual(["0", "1", "2", "3", "4", "5", "sit"]);
});
it("catches up to a stationary farmer, stops one tile away, and faces the mouse only while sitting", () => {
  const s = snapshot(), farmer = { column: 6, row: 5 };
  let state = { ...initialDog(s, { column: 1, row: 5 }, 0), position: { column: 0, row: 5 } };
  state = stepDog(state, s, farmer, 50, 0, -10000);
  expect(state.walking).toBe(true);
  expect(state.flip).toBe(false);
  const frames = new Set<string>();
  for (let i = 0; i < 160; i++) { state = stepDog(state, s, farmer, 50, i * 50, null); frames.add(dogTexture(state)); }
  expect(Math.hypot(state.position.column - farmer.column, state.position.row - farmer.row)).toBeCloseTo(1);
  expect(state.walking).toBe(false);
  expect(frames.size).toBe(7);
  expect(stepDog(state, s, farmer, 50, 9000, -10000).flip).toBe(true);
  expect(stepDog(state, s, farmer, 50, 9000, 10000).flip).toBe(false);
});
it("blocks scenery, ground goods, crops, farm buildings and river", () => {
  const s = snapshot(), cell = { column: 4, row: 5 };
  expect(dogClear(s, cell, 0)).toBe(true);
  s.objects = [{ id, type: "rock", ...cell }];
  expect(dogClear(s, cell, 0)).toBe(false);
  s.objects = [];
  s.groundItems = [{ id, itemKey: "barley", quantity: 1, expiresAt: null, ...cell }];
  expect(dogClear(s, cell, 0)).toBe(false);
  expect(dogClear(s, { column: 1, row: 3 }, 0)).toBe(false);
  expect(dogClear(s, { column: 4, row: 10 }, 0)).toBe(false);
});
it("caps hidden-tab elapsed time and leaves the prior state untouched", () => {
  const s = snapshot(), state = { ...initialDog(s, { column: 1, row: 5 }, 0), position: { column: 0, row: 5 } };
  const before = JSON.stringify(state);
  const next = stepDog(state, s, { column: 6, row: 5 }, 3600000, 3600000, null);
  expect(next.position.column).toBeLessThan(0.1);
  expect(JSON.stringify(state)).toBe(before);
});
