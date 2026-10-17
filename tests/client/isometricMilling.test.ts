import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { millPopupState, millingJourneyPose, millingProgress } from "../../src/client/game/phaser/isometricMilling";
import IsometricMillActions from "../../src/client/components/IsometricMillActions";
import MillActionIcon from "../../src/client/components/BuildingActionIcon";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { millStorageAvailable } from "../../src/game-core/farm/millStorage";
import { millingUnavailableReason } from "../../src/game-core/farm/milling";
import { buildingDemolitionReason } from "../../src/game-core/farm/buildingDemolition";
import { canPickupMillBags, millPickupPath, millDeliveryDestination, millStorageBlocker } from "../../src/client/game/phaser/isometricMillDelivery";
import { INITIAL_FARM_CONFIG } from "../../src/game-data/initialFarm";
const id = "00000000-0000-4000-8000-000000000001";
const date = (time: number) => new Date(time).toISOString();
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, progression: { level: 5, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, breadSold: 0, requestsDelivered: 0 }, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [{ itemKey: "barley", quantity: 2 }], objects: [], groundItems: [], crops: [], improvements: [],
  buildings: [{ id, type: "mill", column: 4, row: 3, storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
    startedAt: date(0), completesAt: date(1), loadingTile: { column: 4, row: 5 } }] });

it("explains each shortage in mixed mill bags and enables storage when the whole pile fits", () => {
  const s = snapshot();
  s.farm.millGoods.pending[id] = { flour: 4, brewersGroats: 2 };
  s.inventory = [{ itemKey: "flour", quantity: 8 }, { itemKey: "brewersGroats", quantity: 9 }];
  expect(millStorageBlocker(s, id, 1000)).toBe("Not enough storage: Flour: 2 spaces free, 4 needed; Brewer's groats: 1 space free, 2 needed. Use or sell stored goods first.");
  expect(canPickupMillBags(s, id, 1000)).toBe(false);
  s.inventory = [{ itemKey: "flour", quantity: 6 }, { itemKey: "brewersGroats", quantity: 8 }];
  expect(millStorageBlocker(s, id, 1000)).toBeNull();
  expect(canPickupMillBags(s, id, 1000)).toBe(true);
});

it("shows flour then groats and replaces both with the exact insufficient-barley message", () => {
  const s = snapshot(), render = () => renderToStaticMarkup(createElement(IsometricMillActions, { snapshot: s, buildingId: id, now: 1000, onMill: () => {} }));
  const html = render();
  expect(html).toContain("mill-flour-bags-isometric.png");
  expect(html).toContain("brewers-groats-icon.png");
  expect(html.indexOf("Make flour (for bread)")).toBeLessThan(html.indexOf("Make groats (for beer)"));
  s.inventory[0]!.quantity = 1;
  expect(render()).toBe('<button disabled="">You don&#x27;t have enough barley</button>');
  s.buildings.push({ ...s.buildings[0]!, id: "00000000-0000-4000-8000-000000000002", type: "granary", storedBarley: 1 });
  expect(millPopupState(s, id, 1000).canStart).toBe(true);
  s.farm.carriedItem = { itemKey: "clay", quantity: 1, expiresAt: null };
  expect(render()).toBe("");
});

it("uses two decorative pickaxes for the mill demolition icon", () => {
  const html = renderToStaticMarkup(createElement(MillActionIcon, { kind: "destroy" }));
  expect(html.match(/<img /g)).toHaveLength(2);
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("flipped");
});

it("reserves separate flour/groats capacity across mills, jobs and deliveries", () => {
  const s = snapshot();
  s.inventory.push({ itemKey: "flour", quantity: 3 });
  s.farm.millGoods.pending = { [id]: { flour: 4, brewersGroats: 10 }, other: { flour: 2, brewersGroats: 0 } };
  expect(millStorageAvailable(s, "flour", 1000)).toBe(1);
  expect(millStorageAvailable(s, "brewersGroats", 1000)).toBe(0);
  expect(renderToStaticMarkup(createElement(IsometricMillActions, { snapshot: s, buildingId: id, now: 1000, onMill: () => {} })))
    .toBe('<button disabled="">Store finished goods to make room</button>');
  s.farm.milling = { buildingId: id, recipe: "flour", barley: 2, output: 1, startedAt: date(2000), completesAt: date(302000) };
  expect(millStorageAvailable(s, "flour", 1000)).toBe(0);
  s.farm.milling = null;
  s.farm.millGoods.pending[id]!.flour = 5;
  expect(millingUnavailableReason(s, "flour", 1000)).toBe("Store finished goods to make room");
  s.farm.millGoods.pending[id]!.flour = 3;
  s.farm.millGoods.delivery = { millId: id, bags: { flour: 2, brewersGroats: 0 } };
  expect(millStorageAvailable(s, "flour", 1000)).toBe(0);
});

it("adds only completed warehouse capacity and protects it from demolition", () => {
  const s = snapshot();
  const warehouse = { ...s.buildings[0]!, id: "00000000-0000-4000-8000-000000000002", type: "warehouse" as const, completesAt: date(2000) };
  s.buildings.push(warehouse);
  s.farm.millGoods.pending[id] = { flour: 10, brewersGroats: 0 };
  expect(millStorageAvailable(s, "flour", 1000)).toBe(0);
  expect(millStorageAvailable(s, "flour", 3000)).toBe(10);
  s.farm.millGoods.pending[id]!.flour = 11;
  expect(buildingDemolitionReason(s, warehouse.id, 3000)).toContain("warehouse storage");
});

it("requires room for the whole donkey batch and includes porter reservations", () => {
  const s = snapshot();
  s.farm.progression!.level = 7;
  s.inventory = [{ itemKey: "barley", quantity: 6 }, { itemKey: "donkey", quantity: 1 }, { itemKey: "flour", quantity: 7 }];
  expect(millingUnavailableReason(s, "flour", 1000, "donkey")).toBeNull();
  s.farm.production.porter = { hiredAt: 0, expiresAt: 99999, checkedAt: 0, position: { column: 0, row: 0 },
    job: { buildingId: id, itemKey: "flour", quantity: 1, startedAt: 0, pickupAt: 100, completesAt: 5000, path: [{ column: 0, row: 0 }], pickupIndex: 0 } };
  expect(millingUnavailableReason(s, "flour", 1000, "donkey")).toBe("No storage space");
});

it("collects mixed mill bags via the loading tile and delivers to the farm", () => {
  const s = snapshot(), home = INITIAL_FARM_CONFIG.farmerSpawn;
  s.farm.millGoods.pending[id] = { flour: 2, brewersGroats: 1 };
  expect(canPickupMillBags(s, id, 1000)).toBe(true);
  const path = millPickupPath(s, id, home, 1000);
  expect(path?.at(-1)).toEqual(s.buildings[0]!.loadingTile);
  expect(path?.slice(1).some(p => p.column === 4 && p.row === 3)).toBe(false);
  s.farm.millGoods = { pending: {}, delivery: { millId: id, bags: { flour: 2, brewersGroats: 1 } } };
  expect(canPickupMillBags(s, id, 1000)).toBe(false);
  expect(millDeliveryDestination(s, path!.at(-1)!, 1000)?.path.at(-1)).toEqual(home);
  s.farm.millGoods = { pending: { [id]: { flour: 2, brewersGroats: 0 } }, delivery: null };
  s.inventory.push({ itemKey: "flour", quantity: 10 });
  expect(canPickupMillBags(s, id, 1000)).toBe(false);
});

it("collects mill output from the road nearest C rather than the old A-side loading point", () => {
  const s = snapshot();
  s.buildings[0] = { ...s.buildings[0]!, column: 4, row: 6, loadingTile: { column: 4, row: 5 } };
  expect(millPickupPath(s, id, INITIAL_FARM_CONFIG.farmerSpawn, 1000)?.at(-1)).toEqual({ column: 5, row: 5 });
});

it("restores partial supply collection and starts work only at saved arrival", () => {
  const s = snapshot();
  s.farm.milling = { buildingId: id, recipe: "flour", worker: "farmer", barley: 2, output: 1, startedAt: date(3000), completesAt: date(303000),
    preparation: { departedAt: 0, stepDurationMs: 1000, path: [{ column: 1, row: 5 }, { column: 2, row: 5 }, { column: 3, row: 5 }, { column: 4, row: 5 }], supplyIndex: 2,
      supplyStops: [{ index: 1, quantity: 1, buildingId: id, column: 2, row: 3 }, { index: 2, quantity: 1, buildingId: null, column: 1, row: 3 }] } };
  expect(millingJourneyPose(s, 500)?.carried).toBe(0);
  expect(millingJourneyPose(s, 1500)).toMatchObject({ carried: 1, position: { column: 2.5, row: 5 } });
  const restored = FarmSnapshotSchema.parse(JSON.parse(JSON.stringify(s)));
  expect(millingJourneyPose(restored, 2500)?.carried).toBe(2);
  expect(millingProgress(restored, id, 2999)).toBeNull();
  expect(millingJourneyPose(restored, 3000)).toBeNull();
  expect(millingProgress(restored, id, 153000)).toMatchObject({ elapsed: 150000, fraction: 0.5, farmer: true });
  expect(millingProgress(restored, id, 303000)).toBeNull();
});
