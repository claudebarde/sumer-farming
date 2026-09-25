import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, shekelTransactions } from "../../src/server/db/schema";
import { getTradeHistory } from "../../src/server/services/tradeHistory";
import { TradeHistoryQuerySchema, TradeHistorySchema } from "../../src/schemas/tradeHistory";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const database = createDatabase(client);
const playerIds = [randomUUID(), randomUUID()];
const timestamp = new Date("2026-09-21T10:00:00.000Z");
const ids = Array.from({ length: 7 }, () => randomUUID()).sort().reverse();
const otherEntryId = randomUUID();
const receiptKey = randomUUID();

beforeAll(async () => {
  await client.connect();
  await database.insert(players).values(playerIds.map(id => ({ id, displayName: "History test" })));
  await database.insert(shekelTransactions).values(ids.map((id, index) => ({
    id, playerId: playerIds[0]!, idempotencyKey: index === 0 ? receiptKey : randomUUID(),
    type: index % 2 === 0 ? "market_sale" as const : "market_purchase" as const,
    source: index % 2 === 0 ? "player" as const : "npc" as const,
    itemKey: "barley" as const, itemQuantity: 2, unitPrice: 3,
    delta: index % 2 === 0 ? 6 : -6, balanceAfter: 10, createdAt: timestamp
  })));
  await database.insert(shekelTransactions).values({
    id: otherEntryId, playerId: playerIds[1]!, idempotencyKey: randomUUID(), type: "market_sale",
    itemKey: "barley", itemQuantity: 1, unitPrice: 1, delta: 1, balanceAfter: 1, createdAt: timestamp
  });
});

afterAll(async () => {
  await database.delete(players).where(inArray(players.id, playerIds));
  await client.end();
});

describe.sequential("personal trade history", () => {
  it("looks up a committed receipt without allowing another player to use its key", async () => {
    const own = await Effect.runPromise(getTradeHistory(database, playerIds[0]!, { limit: 1, transactionKey: receiptKey }));
    expect(own.trades.map(value => value.id)).toEqual([ids[0]]);
    const other = await Effect.runPromise(getTradeHistory(database, playerIds[1]!, { limit: 1, transactionKey: receiptKey }));
    expect(other.trades).toEqual([]);
  });
  it("returns only the player's five latest trades, including NPC and player trades", async () => {
    const page = TradeHistorySchema.parse(await Effect.runPromise(getTradeHistory(database, playerIds[0]!, { limit: 5 })));
    expect(page.trades.map(trade => trade.id)).toEqual(ids.slice(0, 5));
    expect(page.nextCursor).toBe(ids[4]);
    expect(page.trades[0]).toMatchObject({ type: "market_sale", source: "player", quantity: 2, unitPrice: 3, total: 6 });
    expect(page.trades[1]).toMatchObject({ type: "market_purchase", source: "npc", total: 6 });
    expect(page.trades.some(trade => trade.id === otherEntryId)).toBe(false);
  });

  it("continues through tied timestamps without omissions even when a new trade arrives", async () => {
    const first = await Effect.runPromise(getTradeHistory(database, playerIds[0]!, { limit: 5 }));
    const newId = randomUUID();
    await database.insert(shekelTransactions).values({
      id: newId, playerId: playerIds[0]!, idempotencyKey: randomUUID(), type: "market_sale",
      itemKey: "barley", itemQuantity: 1, unitPrice: 1, delta: 1, balanceAfter: 11,
      createdAt: new Date(timestamp.getTime() + 1000)
    });
    const second = await Effect.runPromise(getTradeHistory(database, playerIds[0]!, { limit: 5, before: first.nextCursor! }));
    expect(second.trades.map(trade => trade.id)).toEqual(ids.slice(5));
    expect(second.nextCursor).toBeNull();
    const refreshed = await Effect.runPromise(getTradeHistory(database, playerIds[0]!, { limit: 5 }));
    expect(refreshed.trades[0]?.id).toBe(newId);
  });

  it("returns an empty history for a new player and never follows another player's cursor", async () => {
    expect(await Effect.runPromise(getTradeHistory(database, randomUUID(), { limit: 5 })))
      .toEqual({ trades: [], nextCursor: null });
    expect(await Effect.runPromise(getTradeHistory(database, playerIds[0]!, { limit: 5, before: otherEntryId })))
      .toEqual({ trades: [], nextCursor: null });
  });

  it.each([{ limit: 0 }, { limit: 51 }, { limit: 2.5 }, { before: "invalid" }, { transactionKey: "invalid" }])("rejects invalid pagination %j", query => {
    expect(TradeHistoryQuerySchema.safeParse(query).success).toBe(false);
  });
});
