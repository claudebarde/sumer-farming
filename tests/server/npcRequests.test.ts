import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmCrops, farmInventory, farms, npcRequestBoards, players, shekelTransactions } from "../../src/server/db/schema";
import { batchPlantingAction } from "../../src/server/services/batchPlanting";
import { deliverNpcRequest, getNpcRequests } from "../../src/server/services/npcRequests";
import { getTradeHistory } from "../../src/server/services/tradeHistory";
import { TradeHistorySchema } from "../../src/schemas/tradeHistory";
import { MERCHANT_TRAVEL_MS, REQUEST_CYCLE_MS, REQUEST_OPEN_MS } from "../../src/game-data/npcRequests";
import { getRequestWindow } from "../../src/game-core/market/npcRequests";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => {
  if (ids.size) await db.delete(players).where(inArray(players.id, [...ids]));
  ids.clear();
});
afterAll(() => client.end());

const fixture = async (brewer = false, beer = 2, arriving = false) => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "NPC request test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 7 }).returning();
  await db.insert(farmInventory).values([
    { farmId: farm!.id, itemKey: "barley", quantity: 5 },
    { farmId: farm!.id, itemKey: "beer", quantity: beer }
  ]);
  if (brewer) await db.insert(farmBuildings).values({ farmId: farm!.id, type: "brewery", column: 5, row: 3,
    startedAt: new Date(0), completesAt: new Date(1000), brewingBarley: 2 });
  let board = await Effect.runPromise(getNpcRequests(db, playerId));
  if (!arriving) {
    await db.update(npcRequestBoards).set({ anchor: new Date(Date.now() - 1000) }).where(eq(npcRequestBoards.farmId, farm!.id));
    board = await Effect.runPromise(getNpcRequests(db, playerId));
  }
  const command = (slot = 0) => ({ playerId, slot, cycle: board.cycle, expectedFarmVersion: 1, idempotencyKey: randomUUID() });
  return { playerId, farmId: farm!.id, board, command };
};

describe("NPC requests", () => {
  it("allows an arrival before the first full 24-hour window, rejecting early deliveries", async () => {
    const f = await fixture(false, 2, true);
    expect(f.board.open).toBe(false);
    expect(f.board.requests).toEqual([]);
    expect(Date.parse(f.board.closesAt) - Date.parse(f.board.serverNow)).toBe(REQUEST_OPEN_MS + MERCHANT_TRAVEL_MS);
    expect(await Effect.runPromise(Effect.flip(deliverNpcRequest(db, f.command())))).toMatchObject({ reason: "expired" });
  });
  it("uses exact 24-hour open and 48-hour closed boundaries without missed-window catch-up", () => {
    expect(getRequestWindow(100, 100 + REQUEST_OPEN_MS - 1).open).toBe(true);
    expect(getRequestWindow(100, 100 + REQUEST_OPEN_MS).open).toBe(false);
    expect(getRequestWindow(100, 100 + REQUEST_CYCLE_MS)).toMatchObject({ open: true, cycle: 1 });
    expect(getRequestWindow(100, 100 + REQUEST_CYCLE_MS * 8)).toMatchObject({ open: true, cycle: 8 });
  });

  it("persists three starter requests and pays a delivery exactly once, even with a different retry key", async () => {
    const f = await fixture();
    expect(f.board.requests).toHaveLength(3);
    expect(f.board.requests.every(r => r.beer === 0)).toBe(true);
    expect(await Effect.runPromise(getNpcRequests(db, f.playerId))).toMatchObject({ cycle: 0, closesAt: f.board.closesAt });
    const command = f.command();
    const result = await Effect.runPromise(deliverNpcRequest(db, command));
    expect(result.player.shekelBalance).toBe(5);
    expect(result.player.points).toBe(50);
    expect(result.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(2);
    const retry = await Effect.runPromise(deliverNpcRequest(db, f.command()));
    expect(retry.player.shekelBalance).toBe(5);
    expect(retry.player.points).toBe(50);
    expect((await Effect.runPromise(getNpcRequests(db, f.playerId))).requests[0]?.completed).toBe(true);
    const history = TradeHistorySchema.parse(await Effect.runPromise(getTradeHistory(db, f.playerId, { limit: 5 })));
    expect(history.trades).toHaveLength(1);
    expect(history.trades[0]).toMatchObject({ type: "request_reward", total: 5, itemKey: null, requestCustomer: "Neighbouring household" });
  });

  it("delivers mixed goods atomically without consuming brewery inputs", async () => {
    const f = await fixture(true);
    const result = await Effect.runPromise(deliverNpcRequest(db, f.command(2)));
    expect(result.player.shekelBalance).toBe(18);
    expect(result.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(1);
    expect(result.inventory.find(i => i.itemKey === "beer")).toBeUndefined();
    expect(result.buildings[0]?.brewingBarley).toBe(2);
  });

  it("does not partially deliver when beer is missing", async () => {
    const f = await fixture(true, 0);
    const error = await Effect.runPromise(Effect.flip(deliverNpcRequest(db, f.command(2))));
    expect(error).toMatchObject({ reason: "insufficient_goods" });
    expect((await Effect.runPromise(getNpcRequests(db, f.playerId))).stock.barley).toBe(5);
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId))).toHaveLength(0);
  });

  it("uses granary stock but excludes carried barley and brewery inputs", async () => {
    const f = await fixture(true);
    await db.delete(farmInventory).where(eq(farmInventory.farmId, f.farmId));
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 2 }).where(eq(farms.id, f.farmId));
    expect(await Effect.runPromise(Effect.flip(deliverNpcRequest(db, f.command())))).toMatchObject({ reason: "insufficient_goods" });
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 2, row: 3,
      startedAt: new Date(0), completesAt: new Date(1000), storedBarley: 3 });
    const result = await Effect.runPromise(deliverNpcRequest(db, f.command()));
    expect(result.player.shekelBalance).toBe(5);
    expect(result.farm.carriedItem?.quantity).toBe(2);
    expect(result.buildings.find(b => b.type === "granary")?.storedBarley).toBe(0);
  });

  it("rejects expired windows and resets only at the next fixed opening", async () => {
    const f = await fixture();
    await db.update(npcRequestBoards).set({ anchor: new Date(Date.now() - REQUEST_OPEN_MS - 1000) }).where(eq(npcRequestBoards.farmId, f.farmId));
    expect(await Effect.runPromise(Effect.flip(deliverNpcRequest(db, f.command())))).toMatchObject({ reason: "expired" });
    const closed = await Effect.runPromise(getNpcRequests(db, f.playerId));
    expect(closed.open).toBe(false); expect(closed.requests).toEqual([]);
    await db.update(npcRequestBoards).set({ anchor: new Date(Date.now() - REQUEST_CYCLE_MS - 1000), completed: [0, 1, 2] }).where(eq(npcRequestBoards.farmId, f.farmId));
    const next = await Effect.runPromise(getNpcRequests(db, f.playerId));
    expect(next.cycle).toBe(1); expect(next.requests.every(r => !r.completed)).toBe(true);
    expect(await Effect.runPromise(Effect.flip(deliverNpcRequest(db, f.command())))).toMatchObject({ reason: "expired" });
  });

  it("does not change offers mid-window when a brewery is completed", async () => {
    const f = await fixture();
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "brewery", column: 5, row: 3,
      startedAt: new Date(0), completesAt: new Date(1000) });
    expect((await Effect.runPromise(getNpcRequests(db, f.playerId))).requests.every(r => r.beer === 0)).toBe(true);
    await db.update(npcRequestBoards).set({ anchor: new Date(Date.now() - REQUEST_CYCLE_MS - 1000) }).where(eq(npcRequestBoards.farmId, f.farmId));
    expect((await Effect.runPromise(getNpcRequests(db, f.playerId))).requests[1]?.beer).toBe(2);
  });

  it("isolates players and validates current stock instead of unrelated farm versions", async () => {
    const a = await fixture(); const b = await fixture();
    await Effect.runPromise(deliverNpcRequest(db, a.command()));
    expect((await Effect.runPromise(getNpcRequests(db, b.playerId))).requests[0]?.completed).toBe(false);
    expect((await Effect.runPromise(getTradeHistory(db, b.playerId, { limit: 5 }))).trades).toEqual([]);
    const delivered = await Effect.runPromise(deliverNpcRequest(db, a.command(1)));
    expect(delivered.player.shekelBalance).toBe(8);
    expect(delivered.inventory.find(item => item.itemKey === "barley")?.quantity ?? 0).toBe(0);
  });

  it("delivers beer while a saved harvest job runs despite its newer farm version", async () => {
    const f = await fixture(true);
    const target = { column: 0, row: 8 };
    await db.insert(farmCrops).values({ ...target, farmId: f.farmId, cropKey: "barley",
      sowingStartedAt: new Date(0), plantedAt: new Date(10000), growthCompletesAt: new Date(1810000) });
    const working = await Effect.runPromise(batchPlantingAction(db, {
      type: "start_batch_harvesting", playerId: f.playerId, targets: [target], expectedFarmVersion: 1
    }));
    expect(working.farm.production.planting).not.toBeNull();
    expect(working.farm.version).toBeGreaterThan(1);
    const delivered = await Effect.runPromise(deliverNpcRequest(db, f.command(1)));
    expect(delivered.player.shekelBalance).toBe(12);
    expect(delivered.inventory.find(item => item.itemKey === "beer")).toBeUndefined();
    expect(delivered.farm.production.planting?.id).toBe(working.farm.production.planting?.id);
    expect((await Effect.runPromise(getNpcRequests(db, f.playerId))).requests[1]?.completed).toBe(true);
  });

  it("rejects stale-stock deliveries without reward or partial consumption", async () => {
    const f = await fixture(true);
    await db.update(farmInventory).set({ quantity: 1 }).where(and(eq(farmInventory.farmId, f.farmId), eq(farmInventory.itemKey, "beer")));
    await db.update(farms).set({ version: 2 }).where(eq(farms.id, f.farmId));
    expect(await Effect.runPromise(Effect.flip(deliverNpcRequest(db, f.command(2))))).toMatchObject({ reason: "insufficient_goods" });
    const board = await Effect.runPromise(getNpcRequests(db, f.playerId));
    expect(board.stock).toEqual({ barley: 5, beer: 1 });
    expect(board.requests[2]?.completed).toBe(false);
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId))).toHaveLength(0);
  });

  it("serializes different requests competing for the same beer without overspending", async () => {
    const f = await fixture(true);
    const second = new Client({ connectionString }); await second.connect();
    try {
      const outcomes = await Promise.all([
        Effect.runPromise(Effect.either(deliverNpcRequest(db, f.command(1)))),
        Effect.runPromise(Effect.either(deliverNpcRequest(createDatabase(second), f.command(2))))
      ]);
      expect(outcomes.filter(result => result._tag === "Right")).toHaveLength(1);
      expect(outcomes.find(result => result._tag === "Left")).toMatchObject({ _tag: "Left", left: { reason: "insufficient_goods" } });
      expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId))).toHaveLength(1);
    } finally { await second.end(); }
  });

  it("serializes concurrent retries on separate database connections", async () => {
    const f = await fixture();
    const second = new Client({ connectionString }); await second.connect();
    try {
      const results = await Promise.all([
        Effect.runPromise(deliverNpcRequest(db, f.command())),
        Effect.runPromise(deliverNpcRequest(createDatabase(second), f.command()))
      ]);
      expect(results.map(r => r.player.shekelBalance)).toEqual([5, 5]);
      expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId))).toHaveLength(1);
    } finally { await second.end(); }
  });
});
