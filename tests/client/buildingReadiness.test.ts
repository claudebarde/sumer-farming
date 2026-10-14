import { describe, expect, it } from "vitest";
import { readyProgressionBuilding, readyBuildings, buildingReadinessText } from "../../src/game-core/farm/buildingReadiness";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { evaluateProgression } from "../../src/game-core/farm/progression";
import { createNotificationStore } from "../../src/client/stores/notificationStore";
import { buildingReadinessCandidate } from "../../src/client/features/buildingReadiness";

const snapshot = (level: number, reed: number, clay: number) => FarmSnapshotSchema.parse({
  created: false, player: { shekelBalance: 0 },
  farm: { id: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", version: 1,
    progression: { level, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
    carriedItem: null, gathering: null },
  inventory: [{ itemKey: "reed", quantity: reed }, { itemKey: "clay", quantity: clay }],
  objects: [], groundItems: [], crops: [], improvements: [], buildings: []
});

describe("required building readiness", () => {
  it("waits for the visible material drop, then checks without another tile click", () => {
    const s = snapshot(5, 2, 3);
    s.farm.progression!.stats.buildingReadyAnnounced = ["granary"];
    s.farm.carriedItem = { itemKey: "clay", quantity: 1, expiresAt: null };
    expect(buildingReadinessCandidate(s, null)).toBeNull();
    const store = createNotificationStore(); store.getState().setPlayer(s.farm.playerId);
    store.getState().setMaterialDrop(s.farm.id);
    s.farm.carriedItem = null;
    s.groundItems = [{ id: s.farm.id, itemKey: "clay", quantity: 1, column: -2, row: 2, expiresAt: null }];
    expect(buildingReadinessCandidate(s, store.getState().materialDropFarmId)).toBeNull();
    let candidate: string | null = null;
    const unsubscribe = store.subscribe((next, previous) => {
      if (previous.materialDropFarmId && !next.materialDropFarmId) candidate = buildingReadinessCandidate(s, next.materialDropFarmId);
    });
    store.getState().setMaterialDrop(null);
    expect(candidate).toBe("mill");
    unsubscribe();
    s.groundItems = [];
    expect(buildingReadinessCandidate(s, null)).toBeNull();
    store.getState().setMaterialDrop(s.farm.id);
    store.getState().setPlayer("other");
    expect(store.getState().materialDropFarmId).toBeNull();
  });
  it.each([[2, 2, 3, "granary"], [5, 2, 4, "mill"], [8, 4, 6, "warehouse"]] as const)("notifies for the required building at level %i", (level, reed, clay, building) => {
    const s = snapshot(level, reed, clay);
    expect(readyProgressionBuilding(s)).toBe(building);
    expect(evaluateProgression(s, Date.now()).requirements.some(r => r.label.toLowerCase().includes(building === "granary" ? "granaries" : building))).toBe(true);
    expect(readyBuildings(snapshot(level, reed - 1, clay), level)).not.toContain(building);
    expect(readyBuildings(snapshot(level, reed, clay - 1), level)).not.toContain(building);
  });
  it("includes all unlocked new buildings, with their extra supplies", () => {
    const s = snapshot(8, 100, 100);
    expect(readyBuildings(s, 1)).toEqual([]);
    expect(readyBuildings(s, 5)).toEqual(["granary", "mill"]);
    expect(readyBuildings(s, 8)).toEqual(["granary", "mill", "warehouse", "smallShrine"]);
    s.inventory.push({ itemKey: "brewingVessels", quantity: 2 }, { itemKey: "bakingTools", quantity: 2 });
    expect(readyBuildings(s, 8)).toEqual(["granary", "mill", "brewery", "breadOven", "warehouse", "smallShrine"]);
  });
  it("combines ground and stored materials but not carried resources", () => {
    const s = snapshot(2, 1, 3);
    expect(readyProgressionBuilding({ ...s, farm: { ...s.farm, carriedItem: { itemKey: "reed", quantity: 1, expiresAt: null } } })).toBeNull();
    expect(readyProgressionBuilding({ ...s, groundItems: [{ id: s.farm.id, itemKey: "reed", quantity: 1, column: 0, row: 0, expiresAt: null }] })).toBe("granary");
  });
  it("ignores saved announcements", () => {
    const s = snapshot(2, 2, 3);
    s.farm.progression!.stats.buildingReadyAnnounced = ["granary"];
    expect(readyProgressionBuilding(s)).toBeNull();
    expect(buildingReadinessText("granary")).toEqual({ title: "Ready to build a granary!", description: "You have 2 reeds and 3 clay." });
  });
  it("deduplicates queued toasts and isolates players", () => {
    const store = createNotificationStore(); store.getState().setPlayer("one");
    store.getState().notifyBuilding("one", "farm", "granary");
    store.getState().notifyBuilding("one", "farm", "granary");
    expect(store.getState().pending).toHaveLength(1);
    store.getState().dismiss("building-ready:farm:granary");
    store.getState().notifyBuilding("one", "farm", "granary");
    expect(store.getState().pending).toHaveLength(0);
    store.getState().notifyBuilding("one", "farm", "granary", 4);
    store.getState().notifyBuilding("one", "farm", "granary", 4);
    expect(store.getState().pending).toHaveLength(1);
    store.getState().dismiss("building-ready:farm:granary:4");
    store.getState().notifyBuilding("one", "farm", "granary", 6);
    expect(store.getState().pending).toHaveLength(1);
    store.getState().setPlayer("two"); store.getState().notifyBuilding("one", "farm", "granary");
    expect(store.getState().pending).toHaveLength(0);
  });
});
