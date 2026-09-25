import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players } from "../../src/server/db/schema";
import app from "../../src/server/index";

// Exercise the real HTTP handlers without touching either interactive test farm.
const identities = vi.hoisted(() => [
  { key: "primary", id: crypto.randomUUID(), displayName: "API player 1" },
  { key: "second", id: crypto.randomUUID(), displayName: "API player 2" }
]);
vi.mock("../../src/game-data/developmentPlayers", () => ({
  DEVELOPMENT_PLAYERS: identities,
  resolveDevelopmentPlayer: (key: string | undefined) => identities.find(player => player.key === (key ?? "primary"))
}));

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString });
const db = createDatabase(client);
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
  await client.end();
});

describe.sequential("development HTTP identity and trading", () => {
  it("rejects unknown players before accessing persistence", async () => {
    expect((await request("/api/development/farm", "intruder")).status).toBe(400);
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
    expect(b.player.shekelBalance).toBe(20);

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
    expect(seller.player.shekelBalance).toBe(23);
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

  it("disables test identity APIs in production", async () => {
    vi.stubEnv("DEV", false);
    try {
      for (const path of ["/api/development/farm", "/api/market/quotes", "/api/market/listings", "/api/market/history", "/api/game/action"]) {
        expect((await request(path, "second", path === "/api/game/action" ? {} : undefined)).status).toBe(404);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
