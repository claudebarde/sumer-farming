import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { BatchPlantingSchema } from "../../src/game-data/batchPlanting";
import { isometricHarvestPose, harvestingBlocker, harvestSelectionMaximum, harvestingProgress } from "../../src/client/game/phaser/isometricHarvesting";
import { harvestDeliveryPlan } from "../../src/game-core/farm/harvestDelivery";
import { granaryCapacityForLevel } from "../../src/game-data/storage";
import { farmerHarvestTexture } from "../../src/client/game/phaser/farmerHarvest";
import { isometricTilePopup } from "../../src/client/game/phaser/isometricTilePopup";
import { irrigationBuildBlocker } from "../../src/client/game/phaser/isometricIrrigation";
import { roadBuildBlocker } from "../../src/client/game/phaser/isometricRoads";
import { INITIAL_FARM_CONFIG } from "../../src/game-data/initialFarm";
import { syncHarvestingAudio } from "../../src/client/game/phaser/harvestingAudio";

const id = "00000000-0000-4000-8000-000000000001";
const date = (n: number) => new Date(n).toISOString();
const first = { column: 3, row: 6 }, second = { column: 4, row: 6 };
const batch = () => BatchPlantingSchema.parse({ id, mode: "harvest", total: 2, harvestFieldLimit: 6,
  remaining: [first, second], source: { type: "farm", column: 1, row: 3 }, stopRequested: false, phase: { type: "ready" },
  travelStartedAt: date(1000), nextStepAt: date(1360), travelMs: [360, 180],
  travelPaths: [[{ column: 2, row: 5 }, { column: 3, row: 5 }, first], [first, second]] });
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [first, second].map((cell, i) => ({ ...cell,
    id: `00000000-0000-4000-8000-00000000000${i + 1}`, cropKey: "barley", sowingStartedAt: date(-2000),
    plantedAt: date(-1000), growthCompletesAt: date(0), harvestStartedAt: null, harvestCompletesAt: null })), improvements: [], buildings: [{ id, type: "granary", column: 5, row: 3,
    storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0, loadingTile: { column: 5, row: 5 }, startedAt: date(0), completesAt: date(0) }] });
const delivery = () => harvestDeliveryPlan({ buildings: snapshot().buildings.map(b => ({ ...b, completesAt: 0 })), roads: [], from: second, at: 21540, happiness: 70, hungry: false, level: 1 })!;

describe("isometric harvest presentation", () => {
  it("projects reduced yields and skips expired fields without a harvesting pose", () => {
    const s = snapshot();
    s.buildings = [];
    s.farm.production.planting = batch();
    const day = 24 * 3600000;
    s.crops = s.crops.map((c, i) => ({ ...c, decayEligible: true,
      growthCompletesAt: date(i === 0 ? -day : -2 * day) }));
    expect(isometricHarvestPose(s, 2000)?.type).toBe("harvesting");
    expect(isometricHarvestPose(s, 11540)).toMatchObject({ type: "done", seeds: 1 });
    const popup = isometricTilePopup(s, first, 1000);
    expect(popup.details).toContain("1 barley available");
    expect(popup.details.some(d => d.startsWith("Clears automatically in "))).toBe(true);
    expect(isometricTilePopup(s, second, 1000).actions.harvest).toBe(false);
  });
  it("gates the sound at exact field arrivals and endings, including after reload", () => {
    const s = snapshot();
    s.farm.production.planting = batch();
    for (const [now, expected] of [[1359, false], [1360, true], [11359, true], [11360, false],
      [11539, false], [11540, true], [21540, false], [100000, false]] as const) {
      const restored = FarmSnapshotSchema.parse(JSON.parse(JSON.stringify(s)));
      const sound = { isPlaying: false, setVolume: () => {},
        play: () => { sound.isPlaying = true; return true; }, stop: () => { sound.isPlaying = false; } };
      syncHarvestingAudio(sound, isometricHarvestPose(restored, now)?.type === "harvesting", true, 0.3);
      expect(sound.isPlaying).toBe(expected);
    }
  });
  it("projects a warehouse unload without repeatedly visiting the same storage", () => {
    const s = snapshot();
    s.buildings[0]!.type = "warehouse";
    s.buildings[0]!.storedBarley = 19;
    s.farm.carriedItem = { itemKey: "barley", quantity: 4 };
    s.farm.production.planting = { ...batch(), remaining: [], phase: delivery() };
    const before = JSON.stringify(s);
    expect(isometricHarvestPose(s, 100000)).toMatchObject({ type: "done", position: { column: 1, row: 5 }, seeds: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });
  it("omits carried goods from scenery, water and empty ground but retains them at storage", () => {
    const s = snapshot();
    s.farm.carriedItem = { itemKey: "barley", quantity: 4 };
    const cell = { column: 4, row: 9 };
    for (const type of ["bush", "rock", "reeds"] as const) {
      s.objects = [{ id, type, ...cell }];
      expect(isometricTilePopup(s, cell, 1000).details).not.toContain("Carrying 4 barley");
    }
    expect(isometricTilePopup(s, { column: 4, row: INITIAL_FARM_CONFIG.riverRow }, 1000).details).not.toContain("Carrying 4 barley");
    s.objects = [];
    expect(isometricTilePopup(s, cell, 1000).details).not.toContain("Carrying 4 barley");
    expect(isometricTilePopup(s, { column: 1, row: 3 }, 1000).details).toContain("Carrying 4 barley");
  });
  it("counts completed fields and work time without counting travel", () => {
    const s = snapshot();
    s.farm.production.planting = batch();
    const before = JSON.stringify(s);
    expect(harvestingProgress(s, 1200)).toEqual({ completed: 0, totalMs: 20000, percentage: 0 });
    expect(harvestingProgress(s, 6360)).toEqual({ completed: 0, totalMs: 20000, percentage: 25 });
    expect(harvestingProgress(s, 11400)).toEqual({ completed: 1, totalMs: 20000, percentage: 50 });
    expect(harvestingProgress(s, 16540)).toEqual({ completed: 1, totalMs: 20000, percentage: 75 });
    expect(harvestingProgress(s, 21540)).toEqual({ completed: 2, totalMs: 20000, percentage: 100 });
    expect(harvestingProgress(s, 100000)).toEqual({ completed: 2, totalMs: 20000, percentage: 100 });
    expect(JSON.stringify(s)).toBe(before);
  });
  it("matches progress after reload during the second field and during storage", () => {
    const s = snapshot();
    s.farm.production.planting = { ...batch(), remaining: [], travelPaths: [], travelMs: [],
      phase: { type: "harvesting", target: second, completesAt: date(21540) } };
    expect(harvestingProgress(s, 16540)).toEqual({ completed: 1, totalMs: 20000, percentage: 75 });
    s.farm.production.planting.phase = delivery();
    expect(harvestingProgress(s, 21600)).toEqual({ completed: 2, totalMs: 20000, percentage: 100 });
    s.farm.production.planting = { ...batch(), total: 4, stopRequested: true, remaining: [first, second], phase: delivery() };
    expect(harvestingProgress(s, 21600)).toEqual({ completed: 2, totalMs: 40000, percentage: 50 });
  });
  it.each([[6, 4, 4], [4, 6, 4], [6, 6, 6], [8, 3, 3], [8, 12, 8], [6, 0, 0]])(
    "caps selection capacity %i to %i ripe fields: %i", (capacity, ripe, expected) => {
      expect(harvestSelectionMaximum(capacity, ripe)).toBe(expected);
    }
  );
  it("shows automatic granary level two at estate level seven and above", () => {
    const s = snapshot();
    expect(isometricTilePopup(s, { column: 1, row: 3 }, 1000).level).toBe(1);
    s.farm.progression = { level: 9, breadSold: 0, barleySold: 0, beerSold: 0, requestsDelivered: 0,
      stats: { breadProduced: 0, processedBarley: 0, harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0 } };
    expect(isometricTilePopup(s, { column: 1, row: 3 }, 1000).level).toBe(9);
    expect(isometricTilePopup(s, { column: 6, row: 4 }, 1000).level).toBe(2);
    s.farm.production.buildingUpgrades = { [id]: [{ level: 2, startedAt: date(0), completesAt: date(2000), idempotencyKey: id }] };
    expect(isometricTilePopup(s, { column: 6, row: 4 }, 1999).level).toBe(2);
    expect(isometricTilePopup(s, { column: 6, row: 4 }, 2000).level).toBe(2);
    expect(isometricTilePopup(s, first, 2000).level).toBeNull();
  });
  it("faces the granary before delivery and remains facing it after unloading", () => {
    const s = snapshot();
    s.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
    s.farm.production.planting = { ...batch(), remaining: [], phase: { type: "delivering", granaryId: id,
      path: [{ column: 6, row: 5 }, { column: 5, row: 5 }], startedAt: date(1000), completesAt: date(2000) } };
    expect(isometricHarvestPose(s, 1500)?.facingLeft).toBe(true);
    expect(isometricHarvestPose(s, 1900)).toMatchObject({ facingLeft: false, seeds: 2 });
    expect(isometricHarvestPose(s, 2000)).toMatchObject({ type: "done", facingLeft: false, seeds: 0 });
  });
  it("walks the saved route before harvesting and collects only after work finishes", () => {
    const s = snapshot(); s.farm.production.planting = batch();
    expect(isometricHarvestPose(s, 1180)).toMatchObject({ type: "walking", position: { column: 3, row: 5 }, seeds: 0 });
    expect(isometricHarvestPose(s, 1360)).toMatchObject({ type: "harvesting", position: first, seeds: 0, elapsed: 0 });
    expect(isometricHarvestPose(s, 11359)?.seeds).toBe(0);
    expect(isometricHarvestPose(s, 11360)).toMatchObject({ type: "walking", position: first, seeds: 2, harvested: [first] });
    expect(isometricHarvestPose(s, 11540)).toMatchObject({ type: "harvesting", position: second, seeds: 2 });
  });
  it("begins the shared granary route immediately after the last harvest", () => {
    const s = snapshot(); s.farm.production.planting = batch();
    const phase = delivery();
    expect(isometricHarvestPose(s, 21540)).toMatchObject({ type: "walking", position: second, seeds: 4 });
    expect(isometricHarvestPose(s, Date.parse(phase.completesAt))).toMatchObject({ type: "done", position: phase.path.at(-1), seeds: 0, harvested: [first, second] });
  });
  it("does not replay work on return and never mutates inventory or crops", () => {
    const s = snapshot(); s.farm.production.planting = batch(); const before = JSON.stringify(s);
    expect(isometricHarvestPose(s, 100000)?.type).toBe("done");
    expect(JSON.stringify(s)).toBe(before);
  });
  it("keeps the same pose when a refreshed snapshot arrives during harvest or delivery", () => {
    const old = snapshot(); old.farm.production.planting = batch();
    const refreshed = snapshot(); refreshed.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
    refreshed.farm.production.planting = { ...batch(), remaining: [], travelMs: [], travelPaths: [], phase: { type: "harvesting", target: second, completesAt: date(21540) } };
    for (const now of [12000, 21540, 21700]) {
      const a = isometricHarvestPose(old, now)!, b = isometricHarvestPose(refreshed, now)!;
      expect({ ...a, harvested: [] }).toEqual({ ...b, harvested: [] });
    }
    refreshed.farm.carriedItem.quantity = 4;
    refreshed.farm.production.planting.phase = delivery();
    expect(isometricHarvestPose(refreshed, 21700)?.position).toEqual(isometricHarvestPose(old, 21700)?.position);
  });
  it("leaves excess barley outside a partially full or full granary", () => {
    for (const room of [0, 1]) {
      const s = snapshot(); s.farm.production.planting = batch(); s.buildings[0]!.storedBarley = granaryCapacityForLevel(1) - room;
      s.inventory = [{ itemKey: "barley", quantity: 5 }];
      expect(isometricHarvestPose(s, 100000)).toMatchObject({ type: "done", position: delivery().path.at(-1), seeds: 4 - room });
    }
  });
  it.each([0, 4, 5])("takes granary surplus to the farm with %i barley already stored", (farmQuantity) => {
    const s = snapshot(); s.farm.production.planting = batch();
    s.buildings[0]!.storedBarley = granaryCapacityForLevel(1);
    s.inventory = [{ itemKey: "barley", quantity: farmQuantity }];
    const end = Date.parse(delivery().completesAt);
    if (farmQuantity < 5) {
      expect(isometricHarvestPose(s, end)).toMatchObject({ type: "walking", seeds: 4 });
      expect(isometricHarvestPose(s, 100000)).toMatchObject({ type: "done", position: { column: 1, row: 5 }, seeds: Math.max(0, 4 - (5 - farmQuantity)) });
    } else expect(isometricHarvestPose(s, end)).toMatchObject({ type: "done", seeds: 4 });
  });
  it("waits at the last field when there is no reachable completed granary", () => {
    const s = snapshot(); s.farm.production.planting = batch(); s.buildings = [];
    expect(isometricHarvestPose(s, 100000)).toMatchObject({ type: "done", position: second, seeds: 4 });
  });
  it("finishes the active field then delivers when stopped", () => {
    const s = snapshot(); s.farm.production.planting = { ...batch(), stopRequested: true, remaining: [second], travelMs: [180], travelPaths: [[first, second]], phase: { type: "harvesting", target: first, completesAt: date(11360) } };
    expect(isometricHarvestPose(s, 5000)?.type).toBe("harvesting");
    expect(isometricHarvestPose(s, 11360)).toMatchObject({ type: "walking", position: first, seeds: 2, harvested: [first] });
    expect(isometricHarvestPose(s, 100000)?.harvested).toEqual([first]);
  });
  it("blocks new harvesting with any carried item", () => {
    const s = snapshot(); expect(harvestingBlocker(s, 0)).toBeNull();
    s.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
    expect(harvestingBlocker(s, 0)).toBe("Empty your hands first");
  });
  it("uses the three v2 harvest poses in a restrained ping-pong cycle", () => {
    expect(farmerHarvestTexture(-100)).toBe("farmer-harvest-iso-0");
    expect(farmerHarvestTexture(0)).toBe("farmer-harvest-iso-0");
    expect(farmerHarvestTexture(549)).toBe("farmer-harvest-iso-0");
    expect(farmerHarvestTexture(550)).toBe("farmer-harvest-iso-1");
    expect(farmerHarvestTexture(1100)).toBe("farmer-harvest-iso-2");
    expect(farmerHarvestTexture(1650)).toBe("farmer-harvest-iso-1");
    expect(farmerHarvestTexture(2200)).toBe("farmer-harvest-iso-0");
  });
});

describe("isometric interaction popup model", () => {
  it("shows only currently available actions on an occupied barley tile", () => {
    const s = snapshot();
    s.crops = [];
    s.groundItems = [{ id, ...first, itemKey: "barley", quantity: 1, expiresAt: date(10000) }];
    const popup = isometricTilePopup(s, first, 1000);
    expect(popup.actions).toEqual({ destroyRoad: false, destroyIrrigation: false, destroyMaterial: false, fish: false, gather: null, pickup: true, irrigation: false, road: false, drop: false, plant: false, harvest: false, walk: true });
    expect(popup.details).not.toContain("Connect an adjacent irrigation canal to the river.");
    s.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
    expect(isometricTilePopup(s, first, 1000).actions.pickup).toBe(false);
    s.farm.production.planting = batch();
    expect(Object.values(isometricTilePopup(s, first, 1000).actions).every(value => !value)).toBe(true);
  });
  it("restores build actions when an empty-handed farmer selects eligible ground", () => {
    const s = snapshot(), target = { column: 3, row: 9 };
    expect(isometricTilePopup(s, target, 1000).actions.irrigation).toBe(true);
    s.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
    expect(isometricTilePopup(s, target, 1000).actions.irrigation).toBe(false);
    s.farm.carriedItem = null;
    expect(isometricTilePopup(s, target, 1000).actions.irrigation).toBe(true);
  });
  it("offers pickup only for unexpired ground barley with carrying room", () => {
    const s = snapshot();
    expect(isometricTilePopup(s, first, 1000).pickup).toBe(false);
    s.groundItems = [{ id, ...first, itemKey: "barley", quantity: 2, expiresAt: date(10000) }];
    expect(isometricTilePopup(s, first, 1000)).toMatchObject({ pickup: true, pickupDisabled: null, drop: false });
    s.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: date(10000) };
    expect(isometricTilePopup(s, first, 1000).pickupDisabled).toBeNull();
    s.farm.carriedItem.quantity = 2;
    expect(isometricTilePopup(s, first, 1000).pickupDisabled).toBe("Hands full");
    s.farm.carriedItem = { itemKey: "clay", quantity: 1, expiresAt: null };
    expect(isometricTilePopup(s, first, 1000).pickupDisabled).toBe("Empty your hands first");
    s.farm.carriedItem = null; s.farm.production.planting = batch();
    expect(isometricTilePopup(s, first, 1000).pickupDisabled).toBe("Farmer busy");
    expect(isometricTilePopup(s, first, 10000).pickup).toBe(false);
    s.groundItems[0]!.itemKey = "clay";
    expect(isometricTilePopup(s, first, 1000).pickup).toBe(true);
  });
  it("builds roads next to completed roads and allows clearing decorations", () => {
    const s = snapshot(), target = { column: 3, row: 4 };
    expect(roadBuildBlocker(s, target, 1000)).toBeNull();
    for (const type of ["rock", "bush"] as const) {
      s.objects = [{ id, ...target, type }];
      expect(roadBuildBlocker(s, target, 1000)).toBeNull();
    }
    s.objects = [{ id, ...target, type: "reeds" }];
    expect(roadBuildBlocker(s, target, 1000)).not.toBeNull();
    s.objects = []; s.farm.roads = [{ ...target, completesAt: 5000 }];
    expect(roadBuildBlocker(s, { column: 3, row: 3 }, 4999)).toMatch(/Connect/);
    expect(roadBuildBlocker(s, { column: 3, row: 3 }, 5000)).toBeNull();
  });
  it("blocks road construction on crops, canals, buildings and while carrying", () => {
    const s = snapshot(), target = { column: 3, row: 4 };
    expect(roadBuildBlocker(s, { column: 1, row: 4 }, 1000)).not.toBeNull();
    s.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
    expect(roadBuildBlocker(s, target, 1000)).toBe("Empty your hands first");
    s.farm.carriedItem = null;
    s.improvements = [{ id, ...target, type: "irrigation", startedAt: date(0), completesAt: date(1), destroyStartedAt: null, destroyCompletesAt: null }];
    expect(roadBuildBlocker(s, target, 1000)).not.toBeNull();
    s.improvements = []; s.crops = [{ id, ...target, cropKey: "barley", sowingStartedAt: date(0), plantedAt: date(1), growthCompletesAt: date(2), harvestStartedAt: null, harvestCompletesAt: null }];
    expect(roadBuildBlocker(s, target, 1000)).not.toBeNull();
  });
  it("allows riverbank irrigation and clears rocks/bushes, but not reeds", () => {
    const s = snapshot(), target = { column: 3, row: 9 };
    expect(isometricTilePopup(s, target, 1000)).toMatchObject({ irrigation: true, irrigationDisabled: null });
    for (const type of ["rock", "bush"] as const) {
      s.objects = [{ id, ...target, type }];
      expect(irrigationBuildBlocker(s, target, 1000)).toBeNull();
    }
    s.objects = [{ id, ...target, type: "reeds" }];
    expect(irrigationBuildBlocker(s, target, 1000)).toBe("Tile occupied");
  });
  it("extends only completed canals and blocks building work or carried loads", () => {
    const s = snapshot(), target = { column: 3, row: 8 };
    expect(irrigationBuildBlocker(s, target, 1000)).toMatch(/Connect/);
    s.improvements = [{ id, type: "irrigation", column: 3, row: 9, startedAt: date(0), completesAt: date(5000), destroyStartedAt: null, destroyCompletesAt: null }];
    expect(irrigationBuildBlocker(s, target, 1000)).toMatch(/Connect/);
    expect(irrigationBuildBlocker(s, target, 5000)).toBeNull();
    s.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
    expect(irrigationBuildBlocker(s, target, 5000)).toBe("Empty your hands first");
    s.farm.carriedItem = null; s.farm.production.planting = batch();
    expect(irrigationBuildBlocker(s, target, 5000)).toBe("Farmer busy");
  });
  it("blocks occupied, reserved, river and inaccessible desert locations", () => {
    const s = snapshot();
    for (const target of [{ column: 1, row: 3 }, { column: 1, row: 5 }, { column: 3, row: 10 }, { column: 3, row: 11 }]) {
      expect(irrigationBuildBlocker(s, target, 1000)).not.toBeNull();
    }
    const target = { column: 3, row: 9 };
    s.groundItems = [{ id, ...target, itemKey: "barley", quantity: 1, expiresAt: date(100000) }];
    expect(irrigationBuildBlocker(s, target, 1000)).toBe("Tile occupied");
    s.groundItems = []; s.buildings[0]!.loadingTile = target;
    expect(irrigationBuildBlocker(s, target, 1000)).toBe("Tile occupied");
  });
  it("offers dropping carried barley only on empty arable ground", () => {
    const s = snapshot();
    s.crops = [];
    expect(isometricTilePopup(s, first, 1000).drop).toBe(false);
    s.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
    expect(isometricTilePopup(s, first, 1000)).toMatchObject({ drop: true, dropDisabled: null });
    expect(isometricTilePopup(s, { column: 5, row: 3 }, 1000).drop).toBe(false);
    expect(isometricTilePopup(s, { column: 3, row: 5 }, 1000).drop).toBe(false);
    s.groundItems = [{ id, ...first, itemKey: "barley", quantity: 1, expiresAt: date(100000) }];
    expect(isometricTilePopup(s, first, 1000).drop).toBe(false);
  });
  it("disables dropping during work and hides it after hands are emptied", () => {
    const s = snapshot();
    s.crops = [];
    s.farm.carriedItem = { itemKey: "barley", quantity: 2, expiresAt: null };
    s.farm.production.planting = batch();
    expect(isometricTilePopup(s, first, 1000)).toMatchObject({ drop: true, dropDisabled: "Farmer busy" });
    s.farm.carriedItem = null;
    expect(isometricTilePopup(s, first, 1000).drop).toBe(false);
  });
  it("offers harvest only for ripe barley, not growing barley or date palms", () => {
    const s = snapshot(); s.crops = [{ id, ...first, cropKey: "barley", sowingStartedAt: date(0), plantedAt: date(10), growthCompletesAt: date(1000), harvestStartedAt: null, harvestCompletesAt: null }];
    expect(isometricTilePopup(s, first, 500)).toMatchObject({ title: "Barley", harvest: false, details: ["Ready in 1m"] });
    expect(isometricTilePopup(s, first, 1000)).toMatchObject({ harvest: true, harvestDisabled: null });
    s.crops[0]!.cropKey = "datePalm";
    expect(isometricTilePopup(s, first, 1000).harvest).toBe(false);
  });
  it("recognizes any granary footprint cell and displays actual storage", () => {
    const s = snapshot(); s.buildings[0]!.storedBarley = 3;
    expect(isometricTilePopup(s, { column: 6, row: 4 }, 1000)).toMatchObject({ title: "Granary", details: [`3 / ${granaryCapacityForLevel(1)} barley stored`], plant: false, harvest: false });
  });
  it("shows carried surplus and disables harvesting at the farm", () => {
    const s = snapshot(); s.farm.carriedItem = { itemKey: "barley", quantity: 3, expiresAt: null };
    const model = isometricTilePopup(s, { column: 1, row: 3 }, 1000);
    expect(model).toMatchObject({ title: "Farm", home: true, harvestDisabled: "Empty your hands first" });
    expect(model.details).toContain("Carrying 3 barley");
  });
  it("omits planting and harvesting from the farm popup even with ripe fields", () => {
    const s = snapshot();
    s.crops = [{ id, ...first, cropKey: "barley", sowingStartedAt: date(0), plantedAt: date(10), growthCompletesAt: date(1000), harvestStartedAt: null, harvestCompletesAt: null }];
    expect(isometricTilePopup(s, { column: 1, row: 3 }, 1000).actions).toMatchObject({ plant: false, harvest: false });
    expect(isometricTilePopup(s, first, 1000).harvest).toBe(true);
  });
});
