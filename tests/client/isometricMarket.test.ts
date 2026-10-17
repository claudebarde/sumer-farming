import { expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: { Scene: class {} } }));
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { ProgressionSchema } from "../../src/schemas/progression";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { canVisitIsometricMarket, isometricTradeScope, marketOrigin, marketEntrance } from "../../src/client/game/phaser/isometricMarket";
import { canOpenMarketStand, marketUnlockLevel } from "../../src/game-data/progression";
import { marketIncludesItem } from "../../src/client/stores/marketUiStore";
import { merchantTextures } from "../../src/client/game/phaser/scenes/IsometricMarketScene";

it("uses both dedicated merchant sprites instead of the player's farmer texture", () => {
  expect(merchantTextures).toEqual({ barley: "market-merchant-01", beer: "market-merchant-02", baking: "market-merchant-01" });
});

it("opens the shared bread scope for baking with existing stand and item unlocks", () => {
  const scope = isometricTradeScope("bakingMarket")!;
  expect(scope).toBe("bread");
  expect(canOpenMarketStand(scope, 4)).toBe(false);
  expect(canOpenMarketStand(scope, 5)).toBe(true);
  expect(marketUnlockLevel("flour")).toBe(5);
  expect(marketUnlockLevel("bread")).toBe(6);
  expect(marketIncludesItem(scope, "flour", { market: "npc", action: "sell" })).toBe(true);
  expect(marketIncludesItem(scope, "bread", { market: "player", action: "buy" })).toBe(true);
  expect(marketIncludesItem(scope, "bakingTools", { market: "npc", action: "buy" })).toBe(true);
  expect(marketIncludesItem(scope, "barley")).toBe(false);
  expect(isometricTradeScope("barleyMarket")).toBe("barley");
  expect(isometricTradeScope("beerMarket")).toBe("beer");
  expect(isometricTradeScope("farmReturn")).toBeNull();
});
it("opens the shared beer scope with groats at level 5 and beer/supplies at level 6", () => {
  const scope = isometricTradeScope("beerMarket")!;
  expect(canOpenMarketStand(scope, 4)).toBe(false);
  expect(canOpenMarketStand(scope, 5)).toBe(true);
  expect(marketUnlockLevel("brewersGroats")).toBe(5);
  for (const item of ["beer", "emptyBeerJar", "brewingVessels"]) expect(marketUnlockLevel(item)).toBe(6);
  for (const market of ["npc", "player"] as const) for (const action of ["buy", "sell"] as const) {
    expect(marketIncludesItem(scope, "beer", { market, action })).toBe(true);
    expect(marketIncludesItem(scope, "brewersGroats", { market, action })).toBe(true);
    for (const item of ["emptyBeerJar", "brewingVessels"]) {
      expect(marketIncludesItem(scope, item, { market, action })).toBe(market === "npc" && action === "buy");
    }
    expect(marketIncludesItem(scope, "bread", { market, action })).toBe(false);
  }
});
import { previewWalkable, previewWalkPath } from "../../src/client/game/phaser/isometricWalking";
import { IsometricFarmScene } from "../../src/client/game/phaser/scenes/IsometricFarmScene";
import { IsometricMarketScene, stands } from "../../src/client/game/phaser/scenes/IsometricMarketScene";
import { futureMarketStandOrigins, isMarketRoad, marketRoadMask, marketRoadPath } from "../../src/client/game/phaser/isometricMarketLayout";

const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => {
  const saved = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
    farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
    inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
  saved.farm.progression = ProgressionSchema.parse({ level: 3, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 });
  return saved;
};

it("keeps level, empty hands and availability restrictions", () => {
  const saved = snapshot();
  expect(canVisitIsometricMarket(saved, 0)).toBe(true);
  saved.farm.progression!.level = 2;
  expect(canVisitIsometricMarket(saved, 0)).toBe(false);
  saved.farm.progression!.level = 3;
  saved.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
  expect(canVisitIsometricMarket(saved, 0)).toBe(false);
  saved.farm.carriedItem = null;
  saved.farm.roads = [{ column: 0, row: 6, completesAt: 1000 }];
  expect(canVisitIsometricMarket(saved, 0)).toBe(false);
});

it("routes to the road entrance, never through the market footprint", () => {
  const saved = snapshot();
  expect(previewWalkable(saved, marketOrigin, 0)).toBe(false);
  expect(previewWalkable(saved, { column: 11, row: 4 }, 0)).toBe(false);
  expect(previewWalkPath(saved, { column: 1, row: 5 }, marketEntrance, 0)).toHaveLength(9);
});

const harness = () => {
  const entered = vi.fn(), switched = vi.fn();
  const scene = new IsometricFarmScene(snapshot(), () => {}, () => {}, entered);
  const state = scene as unknown as {
    ready: boolean; drawnAt: number; farmerCell: { column: number; row: number };
    draw: () => void; renderFarmer: () => void; renderRiverWaves: () => void;
    renderStorageChips: () => void; renderFarmerMarker: () => void;
    scene: { switch: typeof switched };
  };
  state.ready = true; state.drawnAt = Date.now();
  state.draw = () => {}; state.renderFarmer = () => {}; state.renderRiverWaves = () => {};
  state.renderStorageChips = () => {}; state.renderFarmerMarker = () => {};
  state.scene = { switch: switched };
  return { scene, state, entered, switched };
};

it("switches only after walking all the way, and accepts a second visit", () => {
  const { scene, state, entered, switched } = harness();
  expect(scene.goToMarket()).toBe(true);
  expect(scene.goToMarket()).toBe(false);
  scene.update(0, 80);
  expect(entered).not.toHaveBeenCalled();
  for (let i = 0; i < 30; i++) scene.update(0, 80);
  expect(state.farmerCell).toEqual(marketEntrance);
  expect(entered).toHaveBeenCalledTimes(1);
  expect(switched).toHaveBeenCalledWith("isometric-market");
  expect(scene.goToMarket()).toBe(true);
  scene.update(0, 16);
  expect(entered).toHaveBeenCalledTimes(2);
});

it("does not teleport into the market if the road entrance is blocked", () => {
  const { scene, state, entered } = harness();
  const saved = snapshot();
  saved.objects = [{ id, type: "rock", ...marketEntrance }];
  state.ready = false;
  scene.setSnapshot(saved);
  expect(scene.goToMarket()).toBe(false);
  expect(entered).not.toHaveBeenCalled();
});

it("cancels arrival when a refreshed snapshot blocks the next road tile", () => {
  const { scene, entered } = harness();
  expect(scene.goToMarket()).toBe(true);
  const saved = snapshot();
  saved.objects = [{ id, type: "rock", column: 2, row: 5 }];
  scene.setSnapshot(saved);
  for (let i = 0; i < 35; i++) scene.update(0, 80);
  expect(entered).not.toHaveBeenCalled();
});

it("returns from the market only after arriving at the farmhouse road entrance", () => {
  const returned = vi.fn(), switched = vi.fn();
  const scene = new IsometricMarketScene(() => {}, returned);
  const state = scene as unknown as {
    ready: boolean; position: { column: number; row: number }; actor: { setFlipX: () => void };
    renderFarmer: () => void; scene: { switch: typeof switched };
  };
  state.ready = true; state.actor = { setFlipX: () => {} };
  state.renderFarmer = () => {}; state.scene = { switch: switched };
  scene.goBackToFarm();
  scene.update(0, 80);
  expect(returned).not.toHaveBeenCalled();
  for (let i = 0; i < 8; i++) scene.update(0, 80);
  expect(state.position).toEqual({ column: -2, row: 5 });
  expect(returned).toHaveBeenCalledTimes(1);
  expect(switched).toHaveBeenCalledWith("isometric-farm");
});

it("connects the rectangular road with two T junctions and two lower corners", () => {
  expect(marketRoadMask({ column: 0, row: 5 })).toBe(13);
  expect(marketRoadMask({ column: 9, row: 5 })).toBe(13);
  expect(marketRoadMask({ column: 0, row: 11 })).toBe(6);
  expect(marketRoadMask({ column: 9, row: 11 })).toBe(3);
  for (const origin of futureMarketStandOrigins) {
    for (let c = 0; c < 2; c++) for (let r = 0; r < 3; r++) {
      expect(isMarketRoad({ column: origin.column + c, row: origin.row + r })).toBe(false);
    }
  }
});

it("routes around the interior and back home, never across future stands", () => {
  const start = { column: 4, row: 11 }, target = { column: -2, row: 5 };
  const path = marketRoadPath(start, target);
  expect(path).toHaveLength(12);
  expect(path.at(-1)).toEqual(target);
  path.forEach((cell, i) => {
    const previous = i ? path[i - 1]! : start;
    expect(isMarketRoad(cell)).toBe(true);
    expect(Math.abs(previous.column - cell.column) + Math.abs(previous.row - cell.row)).toBe(1);
  });
  expect(marketRoadPath(start, { column: 4, row: 8 })).toEqual([]);
});

it("finishes the current step when redirected from the lower loop back home", () => {
  const returned = vi.fn(), scene = new IsometricMarketScene(() => {}, returned);
  const state = scene as unknown as {
    ready: boolean; position: { column: number; row: number }; path: { column: number; row: number }[];
    actor: { setFlipX: () => void }; renderFarmer: () => void; scene: { switch: () => void };
  };
  state.ready = true; state.position = { column: 4.5, row: 11 }; state.path = [{ column: 5, row: 11 }];
  state.actor = { setFlipX: () => {} }; state.renderFarmer = () => {}; state.scene = { switch: () => {} };
  scene.goBackToFarm();
  expect(state.position).toEqual({ column: 4.5, row: 11 });
  scene.update(0, 80);
  expect(state.position.column).toBeGreaterThan(4.5);
  expect(returned).not.toHaveBeenCalled();
  for (let i = 0; i < 40; i++) scene.update(0, 80);
  expect(state.position).toEqual({ column: -2, row: 5 });
  expect(returned).toHaveBeenCalledTimes(1);
});

it.each(stands)("draws a static, clickable $scope merchant in front of its stand", stand => {
  const images: { x: number; y: number; texture: string; depth: number; width: number; name: string; scope?: string; interactive?: boolean }[] = [];
  const scene = new IsometricMarketScene(() => {}, () => {}) as unknown as {
    add: { image: (x: number, y: number, texture: string) => unknown; ellipse: () => unknown }; drawStand(stand: typeof stands[number]): void;
    daylightShadows: { add: () => void; addBuilding: () => void };
  };
  scene.daylightShadows = { add: vi.fn(), addBuilding: vi.fn() };
  scene.add = { ellipse: () => ({ setDepth() {} }), image: (x, y, texture) => {
    const image = { x, y, texture, depth: 0, width: 0, name: "", scope: "", interactive: false,
      setOrigin() { return this; }, setFlipX() { return this; },
      setDisplaySize(width: number) { this.width = width; return this; },
      setDepth(depth: number) { this.depth = depth; return this; },
      setName(name: string) { this.name = name; return this; },
      setData(_key: string, value: string) { this.scope = value; return this; },
      setInteractive() { this.interactive = true; return this; },
    };
    images.push(image); return image;
  } };
  scene.drawStand(stand);
  expect(images).toHaveLength(2);
  expect(images[0]).toMatchObject({ texture: merchantTextures[stand.scope], width: 64, name: `${stand.scope}-merchant-preview` });
  expect(images[1]).toMatchObject({ texture: `market-${stand.scope}`, width: 232, name: `${stand.scope}-stand-preview` });
  expect(images[0]!.depth).toBeGreaterThan(images[1]!.depth);
  expect(images.every(image => image.scope === stand.scope && image.interactive)).toBe(true);
  const offset = (stand.origin.column - 2);
  const rowOffset = stand.origin.row - 2;
  expect(images[0]).toMatchObject({ x: -72 + (offset - rowOffset) * 48, y: 180 + (offset + rowOffset) * 24 });
  expect(images[1]).toMatchObject({ x: (offset - rowOffset) * 48, y: 168 + (offset + rowOffset) * 24 });
});

it("places the baking stand inside the loop with its merchant beside the lower road", () => {
  const baking = stands.find(stand => stand.scope === "baking")!;
  expect(baking.origin).toEqual({ column: 2, row: 8 });
  expect(baking.merchant).toEqual({ column: 3, row: 10.5 });
  expect(isMarketRoad({ column: baking.merchant.column, row: 11 })).toBe(true);
  for (let c = 0; c < 2; c++) for (let r = 0; r < 2; r++) {
    expect(isMarketRoad({ column: baking.origin.column + c, row: baking.origin.row + r })).toBe(false);
  }
});

it.each(stands)("updates the $scope merchant facing while the farmer stands nearby", stand => {
  const setFlipX = vi.fn(), scene = new IsometricMarketScene(() => {}, () => {});
  const state = scene as unknown as {
    ready: boolean; position: { column: number; row: number }; renderFarmer: () => void;
    merchants: { sprite: { setFlipX: typeof setFlipX }; cell: typeof stand.merchant; facing: { flipX: boolean; waitingMs: number } }[];
  };
  state.ready = true; state.renderFarmer = () => {};
  state.position = { column: stand.merchant.column + 2, row: stand.merchant.row + 0.5 };
  state.merchants = [{ sprite: { setFlipX }, cell: stand.merchant, facing: { flipX: true, waitingMs: 0 } }];
  for (let i = 0; i < 3; i++) scene.update(0, 80);
  expect(setFlipX).not.toHaveBeenCalled();
  scene.update(0, 80);
  expect(setFlipX).toHaveBeenCalledExactlyOnceWith(false);
  for (let i = 0; i < 10; i++) scene.update(0, 80);
  expect(setFlipX).toHaveBeenCalledTimes(1);
});

const merchantApproachHarness = () => {
  const report = vi.fn(), renderFarmer = vi.fn(), setFlipX = vi.fn();
  const scene = new IsometricMarketScene(report, () => {});
  const state = scene as unknown as {
    ready: boolean; position: { column: number; row: number }; path: readonly { column: number; row: number }[];
    actor: { setFlipX: typeof setFlipX }; renderFarmer: typeof renderFarmer;
    cameras: { main: { zoom: number; getWorldPoint: () => { x: number; y: number } } };
    approachMerchant: (stand: typeof stands[number]) => void;
    walkTo: (cell: { column: number; row: number }) => void;
  };
  state.ready = true; state.actor = { setFlipX }; state.renderFarmer = renderFarmer;
  state.cameras = { main: { zoom: 1, getWorldPoint: () => ({ x: 0, y: 0 }) } };
  const arrivals = () => report.mock.calls.filter(([anchor]) => anchor !== null);
  return { scene, state, report, renderFarmer, setFlipX, arrivals };
};

it.each(stands)("walks along the road and stops before opening the $scope stand", stand => {
  const { scene, state, renderFarmer, setFlipX, arrivals } = merchantApproachHarness();
  state.approachMerchant(stand);
  expect(arrivals()).toHaveLength(0);
  expect(state.path.length).toBeGreaterThan(0);
  expect(state.path.every(isMarketRoad)).toBe(true);
  scene.update(0, 80);
  expect(arrivals()).toHaveLength(0);
  for (let i = 0; i < 60; i++) scene.update(0, 80);
  expect(state.position).toEqual({ column: stand.merchant.column, row: Math.ceil(stand.merchant.row) });
  expect(state.path).toEqual([]);
  expect(renderFarmer).toHaveBeenLastCalledWith(false);
  expect(setFlipX).toHaveBeenLastCalledWith(false);
  expect(arrivals()).toHaveLength(1);
  expect(arrivals()[0]![0].kind).toBe(stand.kind);
});

it("reroutes mid-step to the latest merchant without opening the previous stand", () => {
  const { scene, state, arrivals } = merchantApproachHarness();
  state.approachMerchant(stands[0]); scene.update(0, 80);
  const before = state.position, next = state.path[0];
  state.approachMerchant(stands[1]);
  expect(state.position).toEqual(before);
  expect(state.path[0]).toEqual(next);
  for (let i = 0; i < 30; i++) scene.update(0, 80);
  expect(arrivals().map(([anchor]) => anchor.kind)).toEqual(["beerMarket"]);
});

it("cancels pending trading when redirected to an ordinary road tile", () => {
  const { scene, state, arrivals } = merchantApproachHarness();
  state.approachMerchant(stands[1]); scene.update(0, 80);
  state.walkTo({ column: 2, row: 5 });
  for (let i = 0; i < 30; i++) scene.update(0, 80);
  expect(arrivals()).toHaveLength(0);
  expect(state.position).toEqual({ column: 2, row: 5 });
});

it("opens once without another walk when already standing in front of the merchant", () => {
  const { scene, state, arrivals } = merchantApproachHarness();
  state.position = { column: 6, row: 5 };
  state.approachMerchant(stands[1]);
  scene.update(0, 16);
  expect(arrivals()).toHaveLength(1);
  scene.clearSelection();
  for (let i = 0; i < 10; i++) scene.update(0, 16);
  expect(arrivals()).toHaveLength(1);
});

it("does not open a merchant popup if no road route can reach the entrance", () => {
  const { scene, state, arrivals } = merchantApproachHarness();
  state.position = { column: 4, row: 8 };
  state.approachMerchant(stands[0]); scene.update(0, 80);
  expect(arrivals()).toHaveLength(0);
});
