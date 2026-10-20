import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { advanceDonkeyWander, donkeyGround, donkeyOwnedAndIdle, DONKEY_REST_MS, DONKEY_START, donkeyRestKey, type DonkeyWander } from "../../src/client/game/phaser/isometricDonkey";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
const a = { column: 4, row: 4 }, b = { column: 5, row: 4 };
const resting: DonkeyWander = { position: a, facingLeft: false, rest: 0, motion: null };
const input = { cells: [a, b], roads: [], occupied: [], delta: 0, movingAllowed: true, random: 0 };
describe("isometric donkey wandering", () => {
  it.each([
    [5, 4, false, false], [4, 5, true, false],
    [3, 4, true, true], [4, 3, false, true],
  ])("faces the screen direction toward (%i,%i) and retains it at rest", (column, row, facingLeft, facingBack) => {
    const to = { column: column as number, row: row as number };
    const options = { ...input, cells: [a, to] };
    const started = advanceDonkeyWander(resting, options)!;
    expect(started).toMatchObject({ facingLeft, facingBack });
    const stopped = advanceDonkeyWander({ ...started, motion: { ...started.motion!, elapsed: 899 } }, { ...options, delta: 1 });
    expect(stopped).toMatchObject({ facingLeft, facingBack, motion: null });
  });
  it("starts in the west just north of the road and falls back safely when occupied", () => {
    const cells = donkeyGround(snapshot(), 1000);
    expect(advanceDonkeyWander(null, { ...input, cells })?.position).toEqual(DONKEY_START);
    const fallback = advanceDonkeyWander(null, { ...input, cells, occupied: [DONKEY_START] })!;
    expect(fallback.position).not.toEqual(DONKEY_START);
    expect(Math.abs(fallback.position.column - DONKEY_START.column) + Math.abs(fallback.position.row - DONKEY_START.row)).toBe(1);
    expect(fallback.position.row).toBeLessThan(5);
    expect(donkeyRestKey(id)).not.toBe(`sumer:donkey:${id}`);
  });
  it.each([[0.2, 3], [0.8, 4]])("walks a %s-choice stroll of %i tiles before resting", (random, length) => {
    const cells = Array.from({ length: 6 }, (_, i) => ({ column: 4 + i, row: 4 }));
    const options = { ...input, cells, random };
    let state = advanceDonkeyWander(resting, options)!;
    expect(state.motion?.remaining).toHaveLength(length - 1);
    for (let step = 1; step <= length; step++) {
      for (let tick = 0; tick < 15; tick++) state = advanceDonkeyWander(state, { ...options, delta: 60 })!;
      expect(state.position).toEqual(cells[step]);
      if (step < length) { expect(state.motion).not.toBeNull(); expect(state.rest).toBe(0); }
    }
    expect(state.motion).toBeNull();
    expect(state.rest).toBe(DONKEY_REST_MS);
  });
  it("carries frame time across boundaries and stops before newly blocked segments", () => {
    const cells = [a, b, { column: 6, row: 4 }, { column: 7, row: 4 }];
    const started = advanceDonkeyWander(resting, { ...input, cells })!;
    const nearEnd = { ...started, motion: { ...started.motion!, elapsed: 880 } };
    const continued = advanceDonkeyWander(nearEnd, { ...input, cells, delta: 60 })!;
    expect(continued.motion?.elapsed).toBe(40);
    expect(continued.position.column).toBeCloseTo(5 + 40 / 900);
    expect(advanceDonkeyWander(nearEnd, { ...input, cells: [a, b], delta: 60 })).toMatchObject({ position: b, motion: null, rest: DONKEY_REST_MS });
  });
  it("appears only after ownership is saved and not during donkey milling", () => {
    const s = snapshot();
    expect(donkeyOwnedAndIdle(s)).toBe(false);
    s.inventory = [{ itemKey: "donkey", quantity: 1 }];
    expect(donkeyOwnedAndIdle(s)).toBe(true);
    s.farm.milling = { buildingId: id, worker: "donkey", recipe: "flour", barley: 6, output: 3,
      startedAt: new Date(0).toISOString(), completesAt: new Date(10000).toISOString() };
    expect(donkeyOwnedAndIdle(s)).toBe(false);
  });
  it("permits northern ground and roads, but not southern tiles or reserved farm/market access", () => {
    const cells = donkeyGround(snapshot(), 1000);
    expect(cells).toContainEqual(a);
    expect(cells).toContainEqual({ column: 4, row: 5 });
    expect(cells.every(p => p.row <= 5)).toBe(true);
    for (const p of [{ column: 1, row: 5 }, { column: 2, row: 5 }, { column: 10, row: 5 }, { column: 1, row: 3 }]) expect(cells).not.toContainEqual(p);
  });
  it("excludes scenery, crops, dropped items, canals, buildings and loading tiles", () => {
    const s = snapshot();
    s.objects = [{ id, type: "bush", column: 4, row: 4 }];
    s.groundItems = [{ id, itemKey: "clay", quantity: 1, expiresAt: null, column: 5, row: 4 }];
    s.improvements = [{ id, type: "irrigation", column: 6, row: 4, startedAt: new Date(0).toISOString(), completesAt: new Date(0).toISOString() }];
    s.buildings = [{ id, type: "mill", column: 7, row: 3, storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0,
      beerReadyAt: null, beerServed: 0, loadingTile: { column: 7, row: 5 }, startedAt: new Date(0).toISOString(), completesAt: new Date(0).toISOString() }];
    const cells = donkeyGround(s, 1000);
    for (const p of [a, b, { column: 6, row: 4 }, { column: 7, row: 4 }, { column: 7, row: 5 }]) expect(cells).not.toContainEqual(p);
  });
  it("avoids road construction and removal", () => {
    const s = snapshot();
    s.farm.roads = [{ ...a, completesAt: 2000 }, { ...b, removing: true, completesAt: 2000 }];
    expect(donkeyGround(s, 1000)).not.toContainEqual(a);
    expect(donkeyGround(s, 1000)).not.toContainEqual(b);
    expect(donkeyGround(s, 3000)).toContainEqual(a);
  });
  it("moves one adjacent step smoothly and then rests, without crossing gaps", () => {
    let state = advanceDonkeyWander(resting, input)!;
    expect(state.motion?.to).toEqual(b);
    state = advanceDonkeyWander(state, { ...input, delta: 80 })!;
    expect(state.position.column).toBeCloseTo(4 + 80 / 900);
    for (let i = 0; i < 12; i++) state = advanceDonkeyWander(state, { ...input, delta: 80 })!;
    expect(state.position).toEqual(b);
    expect(state.motion).toBeNull();
    expect(state.rest).toBeGreaterThan(29000);
    expect(advanceDonkeyWander(resting, { ...input, cells: [a, { column: 6, row: 4 }] })?.motion).toBeNull();
  });
  it("prefers free ground, avoids actors and stays still when enclosed", () => {
    const road = { column: 4, row: 5 };
    expect(advanceDonkeyWander(resting, { ...input, cells: [a, road, b], random: 0.5 })?.motion?.to).toEqual(b);
    expect(advanceDonkeyWander(resting, { ...input, occupied: [b] })?.motion).toBeNull();
    expect(advanceDonkeyWander(resting, { ...input, cells: [a] })?.position).toEqual(a);
    expect(advanceDonkeyWander(null, { ...input, cells: [] })).toBeNull();
  });
  it("freezes when hidden/reduced motion, validates restored positions and cancels newly blocked steps", () => {
    const moving = advanceDonkeyWander(resting, input)!;
    expect(advanceDonkeyWander(moving, { ...input, delta: 999999, movingAllowed: false })).toEqual(moving);
    expect(advanceDonkeyWander(moving, { ...input, cells: [a] })).toMatchObject({ position: a, motion: null });
    expect(advanceDonkeyWander(resting, { ...input, cells: [b] })).toMatchObject({ position: b, motion: null, rest: DONKEY_REST_MS });
    expect(advanceDonkeyWander(resting, { ...input, delta: 0 })).toEqual(moving);
  });
});
