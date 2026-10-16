import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { DOG_SOURCES, initialDog, stepDog, dogTexture, dogClear } from "../../src/client/game/phaser/isometricDog";
import { SWEEP_TILES } from "../../src/client/game/phaser/farmerSweeping";
import { initialWandering, stepWandering } from "../../src/client/game/phaser/dogWandering";
import { bakingDogArea } from "../../src/client/game/phaser/isometricBaking";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
it.each([16, 33, 50])("finishes a turning route without reversing between tile centres (%ims frames)", delta => {
  const s = snapshot(), farmer = { column: 6, row: 5 };
  const goal = { column: 5, row: 6 };
  let result = {
    dog: { ...initialDog(s, farmer, 0), position: { column: 4, row: 5 } },
    state: { idleMs: 20000, goal: goal as typeof goal | null, pauseMs: 0 },
  };
  for (let elapsed = 0; elapsed < 2500 && !result.state.pauseMs; elapsed += delta) {
    const previous = result.dog.position;
    result = stepWandering(result.dog, result.state, s, farmer, delta, elapsed, null, [], true, () => 0.5);
    expect(result.dog.position.column).toBeGreaterThanOrEqual(previous.column);
    expect(result.dog.position.row).toBeGreaterThanOrEqual(previous.row);
  }
  expect(result.dog.position.column).toBeCloseTo(goal.column);
  expect(result.dog.position.row).toBeCloseTo(goal.row);
  expect(result.state.pauseMs).toBe(4000);
});
it("starts at 20 seconds, wanders within three tiles and pauses for 2–6 seconds", () => {
  const s = snapshot(), farmer = { column: 5, row: 5 };
  let result = { dog: initialDog(s, farmer, 0), state: initialWandering() };
  for (let i = 0; i < 399; i++) result = stepWandering(result.dog, result.state, s, farmer, 50, 0, null, [], true, () => 0.5);
  expect(result.state.goal).toBeNull();
  result = stepWandering(result.dog, result.state, s, farmer, 50, 0, null, [], true, () => 0.5);
  expect(result.state.goal).not.toBeNull();
  let paused = false;
  for (let i = 0; i < 600; i++) {
    const previous = result.dog.position;
    result = stepWandering(result.dog, result.state, s, farmer, 50, 0, null, [], true, () => 0.5);
    expect(Math.hypot(result.dog.position.column - farmer.column, result.dog.position.row - farmer.row)).toBeLessThanOrEqual(3.001);
    expect(Math.hypot(result.dog.position.column - previous.column, result.dog.position.row - previous.row)).toBeLessThan(0.1);
    if (result.state.pauseMs > 0) { paused = true; expect(result.state.pauseMs).toBeLessThanOrEqual(6000); }
  }
  expect(paused).toBe(true);
});
it("returns after interruption, resets on reduced motion, and waits for blocked routes", () => {
  const s = snapshot(), farmer = { column: 5, row: 5 };
  let dog = { ...initialDog(s, farmer, 0), position: { column: 2, row: 5 } };
  for (let i = 0; i < 100; i++) dog = stepWandering(dog, initialWandering(), s, farmer, 50, 0, null, []).dog;
  expect(Math.hypot(dog.position.column - 5, dog.position.row - 5)).toBeCloseTo(1);
  const disabled = stepWandering(dog, { idleMs: 30000, goal: null, pauseMs: 3000 }, s, farmer, 50, 0, null, [], false);
  expect(disabled.state).toEqual(initialWandering());
  s.objects = [[3, 5], [1, 5], [2, 6]].map(([column, row]) => ({ id, type: "rock" as const, column: column!, row: row! }));
  dog = { ...dog, position: { column: 2, row: 5 }, target: null };
  expect(stepWandering(dog, initialWandering(), s, farmer, 50, 0, null, []).dog.position).toEqual(dog.position);
});
it("leaves reserved work tiles and catches up when the farmer moves", () => {
  const s = snapshot(), farmer = { column: 2, row: 5 };
  let result = { dog: { ...initialDog(s, farmer, 0), position: { column: 1, row: 5 } }, state: { ...initialWandering(), idleMs: 20000 } };
  for (let i = 0; i < 300; i++) result = stepWandering(result.dog, result.state, s, farmer, 50, 0, null, SWEEP_TILES, true, () => 0.3);
  expect(SWEEP_TILES.some(c => c.column === Math.round(result.dog.position.column) && c.row === Math.round(result.dog.position.row))).toBe(false);
  for (let i = 0; i < 300; i++) result = stepWandering(result.dog, result.state, s, { column: 8, row: 5 }, 50, 0, null, [], true, () => 0.3);
  expect(Math.hypot(result.dog.position.column - 8, result.dog.position.row - 5)).toBeLessThanOrEqual(3);
});
it.each([1, 2])("walks off sweeping tile %i, stays clear and resumes following afterward", column => {
  const s = snapshot(), farmer = { column: column === 1 ? 2 : 1, row: 5 };
  const state = { ...initialDog(s, farmer, 0), position: { column, row: 5 }, target: null };
  let next = stepDog(state, s, farmer, 50, 0, null, SWEEP_TILES);
  expect(next.walking).toBe(true);
  expect(Math.hypot(next.position.column - column, next.position.row - 5)).toBeLessThan(0.1);
  for (let i = 0; i < 100; i++) next = stepDog(next, s, farmer, 50, i * 50, null, SWEEP_TILES);
  expect(next.walking).toBe(false);
  expect(SWEEP_TILES.some(tile => Math.round(next.position.column) === tile.column && Math.round(next.position.row) === tile.row)).toBe(false);
  const resting = next.position;
  for (let i = 0; i < 100; i++) next = stepDog(next, s, { column: i % 2 + 1, row: 5 }, 50, 5000 + i * 50, null, SWEEP_TILES);
  expect(next.position).toEqual(resting);
  expect(stepDog(next, s, { column: 7, row: 5 }, 50, 11000, null).walking).toBe(true);
});
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

it("walks, pauses and walks again beside a baking oven without blocking the road", () => {
  const s = snapshot();
  s.buildings.push({ id, type: "breadOven", column: -2, row: 6, startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString(),
    storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0, loadingTile: { column: -2, row: 5 } });
  s.farm.production.baking[id] = { startedAt: new Date(1000).toISOString(), completesAt: new Date(301000).toISOString(), output: 2 };
  expect(bakingDogArea(s, 999)).toBeNull();
  expect(bakingDogArea(s, 301000)).toBeNull();
  const area = bakingDogArea(s, 1000)!;
  expect(area.anchor).toEqual({ column: -2, row: 5 });
  expect(area.reserved).toHaveLength(4);
  expect(area.reserved.some(p => p.row === 5)).toBe(false);
  let result = { dog: { ...initialDog(s, area.anchor, 1000), position: { column: -3, row: 5 } }, state: initialWandering() };
  let paused = false, walkedAfterPause = false;
  for (let elapsed = 0; elapsed < 60000; elapsed += 50) {
    result = stepWandering(result.dog, result.state, s, area.anchor, 50, 1000 + elapsed, null, area.reserved, true, () => 0.5);
    if (elapsed < 19950) expect(result.state.goal).toBeNull();
    if (result.state.pauseMs > 0) { paused = true; expect(result.state.pauseMs).toBeLessThanOrEqual(6000); }
    if (paused && result.dog.walking) walkedAfterPause = true;
    expect(area.reserved.some(p => p.column === Math.round(result.dog.position.column) && p.row === Math.round(result.dog.position.row))).toBe(false);
    expect(Math.hypot(result.dog.position.column - area.anchor.column, result.dog.position.row - area.anchor.row)).toBeLessThanOrEqual(3.001);
  }
  expect(paused).toBe(true);
  expect(walkedAfterPause).toBe(true);
  const interrupted = stepWandering(result.dog, initialWandering(), s, area.anchor, 50, 62000, 100, area.reserved);
  expect(interrupted.state.goal).toBeNull();
});
