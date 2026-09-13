import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "../../src/server/db/client";
import { players, shekelTransactions } from "../../src/server/db/schema";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";

describe.sequential("player economy", () => {
  let client: Client;
  let database: Database;
  const testPlayerIds = new Set<string>();

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    database = createDatabase(client);
  });

  afterEach(async () => {
    for (const playerId of testPlayerIds) {
      await database.delete(players).where(eq(players.id, playerId));
    }
    testPlayerIds.clear();
  });

  afterAll(async () => {
    await client.end();
  });

  it("starts every player with zero shekels", async () => {
    const playerId = randomUUID();
    testPlayerIds.add(playerId);

    const [player] = await database
      .insert(players)
      .values({ id: playerId, displayName: "Economy test player" })
      .returning({ shekelBalance: players.shekelBalance });

    expect(player?.shekelBalance).toBe(0);
  });

  it("rejects a negative shekel balance", async () => {
    const playerId = randomUUID();
    testPlayerIds.add(playerId);

    const error = await database
      .insert(players)
      .values({
        id: playerId,
        displayName: "Negative balance test player",
        shekelBalance: -1
      })
      .then(
        () => null,
        cause => cause
      );

    expect(error).toMatchObject({
      cause: {
        code: "23514",
        constraint: "players_shekel_balance_nonnegative"
      }
    });
  });

  it("records a market sale with its resulting balance", async () => {
    const playerId = randomUUID();
    const idempotencyKey = randomUUID();
    testPlayerIds.add(playerId);

    await database.insert(players).values({
      id: playerId,
      displayName: "Ledger test player",
      shekelBalance: 6
    });
    await database.insert(shekelTransactions).values({
      playerId,
      idempotencyKey,
      type: "market_sale",
      delta: 6,
      balanceAfter: 6,
      itemKey: "barley",
      itemQuantity: 2,
      unitPrice: 3
    });

    const [transaction] = await database
      .select()
      .from(shekelTransactions)
      .where(eq(shekelTransactions.playerId, playerId));

    expect(transaction).toMatchObject({
      playerId,
      idempotencyKey,
      type: "market_sale",
      delta: 6,
      balanceAfter: 6,
      itemKey: "barley",
      itemQuantity: 2,
      unitPrice: 3
    });
  });

  it("rejects reuse of an idempotency key for the same player", async () => {
    const playerId = randomUUID();
    const idempotencyKey = randomUUID();
    testPlayerIds.add(playerId);

    await database.insert(players).values({
      id: playerId,
      displayName: "Idempotency test player"
    });

    const transaction = {
      playerId,
      idempotencyKey,
      type: "market_sale" as const,
      delta: 2,
      balanceAfter: 2,
      itemKey: "barley" as const,
      itemQuantity: 1,
      unitPrice: 2
    };

    await database.insert(shekelTransactions).values(transaction);
    const error = await database
      .insert(shekelTransactions)
      .values(transaction)
      .then(
        () => null,
        cause => cause
      );

    expect(error).toMatchObject({
      cause: {
        code: "23505",
        constraint: "shekel_transactions_player_idempotency_unique"
      }
    });
  });

  it("rejects ledger entries whose amount does not match the trade", async () => {
    const playerId = randomUUID();
    testPlayerIds.add(playerId);

    await database.insert(players).values({
      id: playerId,
      displayName: "Invalid transaction test player"
    });

    const error = await database
      .insert(shekelTransactions)
      .values({
        playerId,
        idempotencyKey: randomUUID(),
        type: "market_sale",
        delta: 5,
        balanceAfter: 5,
        itemKey: "barley",
        itemQuantity: 2,
        unitPrice: 3
      })
      .then(
        () => null,
        cause => cause
      );

    expect(error).toMatchObject({
      cause: {
        code: "23514",
        constraint: "shekel_transactions_delta_matches_trade"
      }
    });
  });
});
