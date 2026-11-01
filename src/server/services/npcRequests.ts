import { awardPoints } from "./playerPoints";
import { and, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { MERCHANT_TRAVEL_MS, MERCHANT_PRODUCTS, NPC_REQUESTS } from "../../game-data/npcRequests";
import { getRequestWindow, selectMerchantRequests } from "../../game-core/market/npcRequests";
import type { NpcRequests } from "../../schemas/npcRequests";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database, DatabaseTransaction } from "../db/client";
import { farms, npcRequestBoards, players, shekelTransactions } from "../db/schema";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { loadMarketItemStorage, removeFromMarketItemStorage } from "./marketItemStorage";

export class NpcRequestRuleError extends Data.TaggedError("NpcRequestRuleError")<{
  readonly reason: "missing_farm" | "locked" | "expired" | "insufficient_goods" | "version_conflict" | "idempotency_conflict" | "balance_limit";
}> {}
export class NpcRequestPersistenceError extends Data.TaggedError("NpcRequestPersistenceError")<{ readonly cause: unknown }> {}

// Call only while holding the owning farm row lock. One stable schedule per farm.
const loadBoard = async (tx: DatabaseTransaction, farmId: string, level: number, now: Date) => {
  const [existing] = await tx.select().from(npcRequestBoards).where(eq(npcRequestBoards.farmId, farmId));
  // New visits enter first, then offer a full 24 hours of requests at rest.
  const anchor = existing?.anchor ?? new Date(now.getTime() + MERCHANT_TRAVEL_MS);
  const window = getRequestWindow(anchor.getTime(), now.getTime());
  if (existing && existing.cycle === window.cycle) return { board: existing, window };
  const requests = selectMerchantRequests(farmId, window.cycle, level,
    existing ? existing.requests ?? NPC_REQUESTS[existing.brewer ? "brewer" : "starter"] : []);
  const [board] = await tx.insert(npcRequestBoards).values({
    farmId, anchor, cycle: window.cycle, brewer: false, requests, completed: []
  }).onConflictDoUpdate({ target: npcRequestBoards.farmId,
    set: { cycle: window.cycle, brewer: false, requests, completed: [] }
  }).returning();
  return { board: board!, window };
};

export const getNpcRequests = (database: Database, playerId: string) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => database.transaction(async tx => {
      const [loaded] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
      if (!loaded) return null;
      if (loaded.level < 7) return "locked" as const;
      const now = new Date();
      const farm = await advanceFarmLifecycle(tx, loaded, now);
      const { board, window } = await loadBoard(tx, farm.id, farm.level, now);
      const stock = { barley: 0, beer: 0, flour: 0, brewersGroats: 0, bread: 0, dates: 0, sesame: 0, oil: 0 };
      for (const product of MERCHANT_PRODUCTS) {
        stock[product] = (await loadMarketItemStorage(tx, farm.id, product, now)).storedQuantity;
      }
      return {
        serverNow: now.toISOString(), cycle: window.cycle, open: window.open,
        closesAt: new Date(window.closesAt).toISOString(), nextOpensAt: new Date(window.nextOpensAt).toISOString(),
        stock,
        requests: window.open ? (board.requests ?? NPC_REQUESTS[board.brewer ? "brewer" : "starter"]).map((request, slot) => ({
          ...request, slot, completed: board.completed.includes(slot)
        })) : []
      } satisfies NpcRequests;
    }),
    catch: cause => new NpcRequestPersistenceError({ cause })
  });
  return result === null || result === "locked" ? yield* Effect.fail(new NpcRequestRuleError({ reason: result === null ? "missing_farm" : "locked" })) : result;
});

type DeliveryInput = {
  readonly playerId: string; readonly cycle: number; readonly slot: number;
  readonly expectedFarmVersion: number; readonly idempotencyKey: string;
};
type Outcome = { readonly snapshot: FarmSnapshot } | { readonly reason: NpcRequestRuleError["reason"] };

export const deliverNpcRequest = (database: Database, input: DeliveryInput) => Effect.gen(function* () {
  const outcome = yield* Effect.tryPromise({
    try: (): Promise<Outcome> => database.transaction(async tx => {
      const [loaded] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
      if (!loaded) return { reason: "missing_farm" };
      if (loaded.level < 7) return { reason: "locked" };
      // Read time after acquiring the lock, so a queued delivery cannot beat expiry.
      const now = new Date();
      const farm = await advanceFarmLifecycle(tx, loaded, now);
      const { board, window } = await loadBoard(tx, farm.id, farm.level, now);
      if (!window.open || input.cycle !== window.cycle) return { reason: "expired" };
      const request = (board.requests ?? NPC_REQUESTS[board.brewer ? "brewer" : "starter"])[input.slot];
      if (!request) return { reason: "expired" };
      if (board.completed.includes(input.slot)) return { snapshot: await readFarmSnapshot(tx, farm, false) };
      // A fixed visit/slot identifies the exact agreed offer. Unrelated harvest
      // progress may change farm.version; validate current goods under this row
      // lock instead. Completion and receipt guards still prevent duplicate pay.
      const [duplicate] = await tx.select({ id: shekelTransactions.id }).from(shekelTransactions).where(and(
        eq(shekelTransactions.playerId, input.playerId), eq(shekelTransactions.idempotencyKey, input.idempotencyKey)
      ));
      if (duplicate) return { reason: "idempotency_conflict" };
      const deliveries = [];
      for (const product of MERCHANT_PRODUCTS) {
        const quantity = request[product] ?? 0;
        if (quantity === 0) continue;
        const storage = await loadMarketItemStorage(tx, farm.id, product, now);
        if (storage.storedQuantity < quantity) return { reason: "insufficient_goods" };
        deliveries.push({ storage, quantity });
      }
      const [player] = await tx.select().from(players).where(eq(players.id, input.playerId)).for("update");
      if (!player) return { reason: "missing_farm" };
      const balance = player.shekelBalance + request.reward;
      if (balance > 2_147_483_647) return { reason: "balance_limit" };
      for (const { storage, quantity } of deliveries) await removeFromMarketItemStorage(tx, storage, quantity, now);
      await tx.update(players).set({ shekelBalance: balance, updatedAt: now }).where(eq(players.id, player.id));
      await tx.insert(shekelTransactions).values({ playerId: player.id, idempotencyKey: input.idempotencyKey,
        type: "request_reward", requestCustomer: request.customer, delta: request.reward, balanceAfter: balance, createdAt: now });
      await tx.update(npcRequestBoards).set({ completed: [...board.completed, input.slot] }).where(eq(npcRequestBoards.farmId, farm.id));
      await awardPoints(tx, farm.playerId, { action: "merchantRequest", source: `request:${farm.id}:${input.cycle}:${input.slot}`, completedAt: now });
      const [updated] = await tx.update(farms).set({ version: sql`${farms.version} + 1`, updatedAt: now }).where(eq(farms.id, farm.id)).returning();
      return { snapshot: await readFarmSnapshot(tx, updated!, false) };
    }),
    catch: cause => new NpcRequestPersistenceError({ cause })
  });
  return "reason" in outcome ? yield* Effect.fail(new NpcRequestRuleError({ reason: outcome.reason })) : outcome.snapshot;
});
