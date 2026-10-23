import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, farms, farmInventory, farmBuildings, farmCrops, npcRequestBoards, neighbourhoods, neighbourhoodMembers } from "../../src/server/db/schema";
import app from "../../src/server/index";

// Exercise the real HTTP handlers without touching either interactive test farm.
const identities = vi.hoisted(() => [
  { key: "primary", id: crypto.randomUUID(), displayName: "API player 1" },
  { key: "second", id: crypto.randomUUID(), displayName: "API player 2" },
  { key: "onboarding", id: crypto.randomUUID(), displayName: "API onboarding" }
]);
vi.mock("../../src/game-data/developmentPlayers", () => ({
  DEVELOPMENT_PLAYERS: identities,
  resolveDevelopmentPlayer: (key: string | undefined) => identities.find(player => player.key === (key ?? "primary"))
}));

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString });
const db = createDatabase(client);
const testNeighbourhoods: string[] = [];
const env = { HYPERDRIVE: { connectionString } };
const request = (path: string, player: string, body?: unknown) => app.request(path, {
  method: body === undefined && path !== "/api/development/farm" ? "GET" : "POST",
  headers: { "x-development-player": player, "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
}, env);

beforeAll(() => client.connect());
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.delete(players).where(inArray(players.id, identities.map(player => player.id)));
  if (testNeighbourhoods.length) await db.delete(neighbourhoods).where(inArray(neighbourhoods.id, testNeighbourhoods));
  await client.end();
});

describe.sequential("development HTTP identity and trading", () => {
  it("rejects unknown players before accessing persistence", async () => {
    expect((await request("/api/development/farm", "intruder")).status).toBe(400);
  });

  it("keeps the fresh playthrough out of the selector until its farmer is named", async () => {
    const response = await request("/api/development/farm", "onboarding");
    expect(response.status).toBe(200);
    const fresh = await response.json();
    expect(fresh.created).toBe(true);
    expect(fresh.farm.progression.level).toBe(1);
    expect(fresh.player.shekelBalance).toBe(0);
    expect(fresh.farm.farmerProfile).toBeNull();
    expect((await (await request("/api/residence", "onboarding")).json()).residence).toBeNull();
    const before = await request("/api/development/players", "onboarding");
    expect(before.headers.get("Cache-Control")).toBe("no-store");
    expect((await before.json()).players).toEqual([]);
    expect((await request("/api/farmer/profile", "onboarding", { type: "name_farmer", name: "Gudea" })).status).toBe(200);
    expect((await (await request("/api/development/players", "onboarding")).json()).players).toEqual([{ key: "onboarding", name: "Gudea" }]);
    const again = await (await request("/api/development/farm", "onboarding")).json();
    expect(again.created).toBe(false);
    expect(again.farm.id).toBe(fresh.farm.id);
    expect(again.farm.farmerProfile.identity.name).toBe("Gudea");
  });

  it("creates two farms and routes listing, ownership and purchase to the selected identity", async () => {
    const aResponse = await request("/api/development/farm", "primary");
    const bResponse = await request("/api/development/farm", "second");
    expect(aResponse.status).toBe(200);
    expect(bResponse.status).toBe(200);
    const a = await aResponse.json();
    const b = await bResponse.json();
    expect(a.farm.playerId).toBe(identities[0]!.id);
    expect(b.farm.playerId).toBe(identities[1]!.id);
    expect(b.player.shekelBalance).toBe(0);
    expect(b.farm.progression.level).toBe(1);
    expect((await (await request("/api/residence", "second")).json()).residence).toBeNull();
    expect((await request("/api/game/action", "second", { type: "create_market_sell_order", itemKey: "barley", quantity: 1, unitPrice: 3, expectedFarmVersion: b.farm.version, idempotencyKey: crypto.randomUUID() })).status).toBe(409);
    expect((await request("/api/residence", "second", { type: "settle", city: "not-a-city" })).status).toBe(400);
    expect((await request("/api/residence", "primary", { type: "found", city: "lagash", name: "Friends", private: true })).status).toBe(400);
    expect((await request("/api/residence", "second", { type: "join", city: "lagash", inviteCode: crypto.randomUUID() })).status).toBe(400);
    // Isolated legacy membership fixture: do not join or delete interactive public groups.
    const [home] = await db.insert(neighbourhoods).values({ city: "lagash", name: "API test neighbourhood", private: true }).returning();
    testNeighbourhoods.push(home!.id);
    await db.insert(neighbourhoodMembers).values(identities.slice(0, 2).map((player, index) => ({ playerId: player.id, neighbourhoodId: home!.id, slot: index + 1 })));
    expect((await request("/api/residence", "primary", { type: "settle", city: "lagash" })).status).toBe(200);
    expect((await request("/api/farmer/profile", "primary", { type: "name_farmer", name: "Meskalamdug" })).status).toBe(200);
    expect((await request("/api/farmer/profile", "second", { type: "name_farmer", name: "Geme-Bau" })).status).toBe(200);
    const namedA = await (await request("/api/development/farm", "primary")).json();
    const namedB = await (await request("/api/development/farm", "second")).json();
    a.farm.version = namedA.farm.version;
    b.farm.version = namedB.farm.version;
    expect(namedA.farm.farmerProfile.identity.name).toBe("Meskalamdug");
    expect(namedB.farm.farmerProfile.identity.name).toBe("Geme-Bau");
    const lockedTrade = await request("/api/game/action", "second", {
      type: "create_market_sell_order", itemKey: "barley", quantity: 1, unitPrice: 3,
      expectedFarmVersion: b.farm.version, idempotencyKey: crypto.randomUUID()
    });
    expect(lockedTrade.status).toBe(422);
    await db.update(farms).set({ level: 3 }).where(inArray(farms.playerId, identities.map(player => player.id)));
    await db.insert(farmInventory).values({ farmId: b.farm.id, itemKey: "barley", quantity: 2 });

    // Test-only funding; normal players still start with zero shekels.
    await db.update(players).set({ shekelBalance: 10 }).where(eq(players.id, identities[0]!.id));
    const listing = await request("/api/game/action", "second", {
      type: "create_market_sell_order", itemKey: "barley", quantity: 1, unitPrice: 3,
      expectedFarmVersion: b.farm.version, idempotencyKey: crypto.randomUUID()
    });
    expect(listing.status).toBe(200);
    const listings = await (await request("/api/market/listings?itemKey=barley&action=sell", "second")).json();
    const order = listings.orders[0];
    expect(order).toBeDefined();
    const otherListings = await (await request("/api/market/listings?itemKey=barley&action=buy", "primary")).json();
    expect(otherListings.orders.some((value: { id: string }) => value.id === order.id)).toBe(true);
    const purchase = await request("/api/game/action", "primary", {
      type: "buy_market_sell_order", orderId: order.id, quantity: 1, expectedUnitPrice: 3,
      expectedFarmVersion: a.farm.version, idempotencyKey: crypto.randomUUID(),
      playerId: identities[1]!.id // Client-provided identity cannot override the resolved player.
    });
    expect(purchase.status).toBe(200);
    const bought = await purchase.json();
    expect(bought.farm.playerId).toBe(identities[0]!.id);
    expect(bought.player.shekelBalance).toBe(7);
    expect(bought.inventory).toContainEqual({ itemKey: "barley", quantity: 1 });
    const seller = await (await request("/api/development/farm", "second")).json();
    expect(seller.player.shekelBalance).toBe(3);
    const buyerHistory = await (await request("/api/market/history?limit=5", "primary")).json();
    const sellerHistory = await (await request("/api/market/history?limit=5", "second")).json();
    expect(buyerHistory.trades).toHaveLength(1);
    expect(sellerHistory.trades).toHaveLength(1);
    expect(buyerHistory.trades[0]).toMatchObject({ type: "market_purchase", source: "player", quantity: 1, total: 3 });
    expect(sellerHistory.trades[0]).toMatchObject({ type: "market_sale", source: "player", quantity: 1, total: 3 });
    expect(buyerHistory.trades[0].id).not.toBe(sellerHistory.trades[0].id);
  });

  it("validates history pagination and rejects unknown identities", async () => {
    expect((await request("/api/market/history?limit=1000", "primary")).status).toBe(400);
    expect((await request("/api/market/history?before=invalid", "primary")).status).toBe(400);
    expect((await request("/api/market/history", "intruder")).status).toBe(400);
  });

  it("validates listing cursors and rejects unknown identities", async () => {
    expect((await request("/api/market/listings?itemKey=barley&action=buy&after=invalid", "primary")).status).toBe(400);
    expect((await request("/api/market/listings?itemKey=barley&action=buy&after=%7B%7D", "primary")).status).toBe(400);
    expect((await request("/api/market/listings?itemKey=barley&action=invalid", "primary")).status).toBe(400);
    expect((await request("/api/market/listings?itemKey=barley&action=sell", "intruder")).status).toBe(400);
  });

  it("scopes live visitors to the resolved identity and validates market roads", async () => {
    const visit = { type: "join", sessionId: crypto.randomUUID(), position: { column: 0, row: 5 } };
    expect((await request("/api/market/presence", "intruder", visit)).status).toBe(400);
    expect((await request("/api/market/presence", "primary", { ...visit, position: { column: 1, row: 5 } })).status).toBe(400);
    const other = { ...visit, sessionId: crypto.randomUUID() };
    expect((await request("/api/market/presence", "second", other)).status).toBe(200);
    const response = await request("/api/market/presence", "primary", { ...visit, playerId: identities[1]!.id, neighbourhoodId: crypto.randomUUID() });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ visitors: [{ playerId: identities[1]!.id, name: "Geme-Bau" }] });
    expect((await request("/api/market/presence", "second", { type: "leave", sessionId: other.sessionId })).status).toBe(200);
    expect(await (await request("/api/market/presence", "primary", { ...visit, type: "heartbeat" })).json()).toEqual({ visitors: [] });
  });

  it("validates leaderboard queries and uses the resolved viewer identity", async () => {
    expect((await request("/api/leaderboard?metric=unknown", "primary")).status).toBe(400);
    expect((await request("/api/leaderboard?scope=other", "primary")).status).toBe(400);
    expect((await request("/api/leaderboard", "intruder")).status).toBe(400);
    const response = await request(`/api/leaderboard?scope=local&metric=shekels&playerId=${identities[1]!.id}`, "primary");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ scope: "local", metric: "shekels", self: { playerId: identities[0]!.id, isYou: true, score: 7 } });
  });

  it("delivers merchant beer through HTTP during harvesting without releasing the farmer", async () => {
    const player = "second";
    const initial = await (await request("/api/development/farm", player)).json();
    const farmId = initial.farm.id;
    await db.update(farms).set({ level: 7 }).where(eq(farms.id, farmId));
    await db.insert(farmInventory).values({ farmId, itemKey: "beer", quantity: 2 });
    await db.insert(farmBuildings).values({ farmId, type: "brewery", column: 5, row: 3,
      startedAt: new Date(0), completesAt: new Date(1000) });
    await db.insert(farmCrops).values({ farmId, column: 0, row: 8, cropKey: "barley",
      sowingStartedAt: new Date(0), plantedAt: new Date(10000), growthCompletesAt: new Date(1810000) });
    await request("/api/market/requests", player);
    await db.update(npcRequestBoards).set({ anchor: new Date(Date.now() - 1000) }).where(eq(npcRequestBoards.farmId, farmId));
    const board = await (await request("/api/market/requests", player)).json();
    const before = await (await request("/api/development/farm", player)).json();
    const start = await request("/api/game/action", player, { type: "start_batch_harvesting",
      targets: [{ column: 0, row: 8 }], expectedFarmVersion: before.farm.version });
    expect(start.status).toBe(200);
    const working = await start.json();
    expect(working.farm.production.planting).not.toBeNull();
    const command = { type: "deliver_npc_request", cycle: board.cycle, slot: 1,
      expectedFarmVersion: before.farm.version, idempotencyKey: crypto.randomUUID() };
    const response = await request("/api/game/action", player, command);
    const delivered = await response.json();
    expect(delivered).not.toHaveProperty("error");
    expect(response.status).toBe(200);
    expect(delivered.player.shekelBalance).toBe(before.player.shekelBalance + 12);
    expect(delivered.farm.production.planting.id).toBe(working.farm.production.planting.id);
    expect(delivered.inventory.some((item: { itemKey: string }) => item.itemKey === "beer")).toBe(false);
    const retry = await request("/api/game/action", player, command);
    expect(retry.status).toBe(200);
    expect((await retry.json()).player.shekelBalance).toBe(delivered.player.shekelBalance);
    const blocked = await request("/api/game/action", player, { type: "start_batch_harvesting",
      targets: [{ column: 1, row: 8 }], expectedFarmVersion: delivered.farm.version });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ error: { type: "farmer_busy" } });
  });

  it.each(["plant", "harvest"] as const)("starts mill upgrades through HTTP during %s work, charging once and preserving work", async mode => {
    const player = "second";
    const before = await (await request("/api/development/farm", player)).json();
    const farmId = before.farm.id;
    const batch = { id: crypto.randomUUID(), mode, total: 1, remaining: [{ column: 1, row: 8 }],
      source: { type: "farm" as const, column: 0, row: 3 }, stopRequested: false,
      phase: { type: "collecting" as const }, nextStepAt: new Date(Date.now() + 3600000).toISOString() };
    await db.update(farms).set({ level: 8, production: { ...before.farm.production, buildingUpgrades: {}, planting: batch } }).where(eq(farms.id, farmId));
    await db.update(players).set({ shekelBalance: 500 }).where(eq(players.id, identities[1]!.id));
    const [mill] = await db.insert(farmBuildings).values({ farmId, type: "mill", column: mode === "plant" ? 8 : 10, row: 3,
      startedAt: new Date(0), completesAt: new Date(1) }).returning();
    const command = { type: "upgrade_building", buildingId: mill!.id, targetLevel: 2,
      expectedFarmVersion: before.farm.version, idempotencyKey: crypto.randomUUID() };
    const response = await request("/api/game/action", player, command);
    expect(response.status).toBe(200);
    const upgraded = await response.json();
    expect(upgraded.player.shekelBalance).toBe(400);
    expect(upgraded.farm.production.planting).toEqual(batch);
    const saved = upgraded.farm.production.buildingUpgrades[mill!.id][0];
    expect(Date.parse(saved.completesAt) - Date.parse(saved.startedAt)).toBe(300000);
    const retry = await request("/api/game/action", player, command);
    expect(retry.status).toBe(200);
    expect((await retry.json()).player.shekelBalance).toBe(400);
  });

  it("disables test identity APIs in production", async () => {
    vi.stubEnv("DEV", false);
    try {
      for (const path of ["/api/development/players", "/api/leaderboard", "/api/development/farm", "/api/market/quotes", "/api/market/listings", "/api/market/history", "/api/game/action"]) {
        expect((await request(path, "second", path === "/api/game/action" ? {} : undefined)).status).toBe(404);
      }
      expect((await request("/api/market/presence", "primary", { type: "join" })).status).toBe(404);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
