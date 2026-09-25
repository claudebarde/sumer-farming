import { and, eq, lte, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { NPC_REQUESTS } from "../../game-data/npcRequests";
import { canDeliverRequest, getRequestWindow } from "../../game-core/market/npcRequests";
import type { NpcRequests } from "../../schemas/npcRequests";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database, DatabaseTransaction } from "../db/client";
import { farms, farmBuildings, npcRequestBoards, players, shekelTransactions } from "../db/schema";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { loadMarketItemStorage, removeFromMarketItemStorage } from "./marketItemStorage";

export class NpcRequestRuleError extends Data.TaggedError("NpcRequestRuleError")<{
  readonly reason: "missing_farm" | "expired" | "insufficient_goods" | "version_conflict" | "idempotency_conflict" | "balance_limit";
}> {}
export class NpcRequestPersistenceError extends Data.TaggedError("NpcRequestPersistenceError")<{ readonly cause: unknown }> {}

// Call only while holding the owning farm row lock. One stable schedule per farm.
const loadBoard = async (tx: DatabaseTransaction, farmId: string, now: Date) => {
  const [existing] = await tx.select().from(npcRequestBoards).where(eq(npcRequestBoards.farmId, farmId));
  const anchor = existing?.anchor ?? now;
  const window = getRequestWindow(anchor.getTime(), now.getTime());
  if (existing && existing.cycle === window.cycle) return { board: existing, window };
  const [brewery] = await tx.select({ id: farmBuildings.id }).from(farmBuildings).where(and(
    eq(farmBuildings.farmId, farmId), eq(farmBuildings.type, "brewery"),
    lte(farmBuildings.completesAt, new Date(window.opensAt))
  )).limit(1);
  const [board] = await tx.insert(npcRequestBoards).values({
    farmId, anchor, cycle: window.cycle, brewer: brewery !== undefined, completed: []
  }).onConflictDoUpdate({ target: npcRequestBoards.farmId,
    set: { cycle: window.cycle, brewer: brewery !== undefined, completed: [] }
  }).returning();
  return { board: board!, window };
};

export const getNpcRequests = (database: Database, playerId: string) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => database.transaction(async tx => {
      const [loaded] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
      if (!loaded) return null;
      const now = new Date();
      const farm = await advanceFarmLifecycle(tx, loaded, now);
      const { board, window } = await loadBoard(tx, farm.id, now);
      const barley = await loadMarketItemStorage(tx, farm.id, "barley", now);
      const beer = await loadMarketItemStorage(tx, farm.id, "beer", now);
      return {
        serverNow: now.toISOString(), cycle: window.cycle, open: window.open,
        closesAt: new Date(window.closesAt).toISOString(), nextOpensAt: new Date(window.nextOpensAt).toISOString(),
        stock: { barley: barley.storedQuantity, beer: beer.storedQuantity },
        requests: window.open ? NPC_REQUESTS[board.brewer ? "brewer" : "starter"].map((request, slot) => ({
          ...request, slot, completed: board.completed.includes(slot)
        })) : []
      } satisfies NpcRequests;
    }),
    catch: cause => new NpcRequestPersistenceError({ cause })
  });
  return result === null ? yield* Effect.fail(new NpcRequestRuleError({ reason: "missing_farm" })) : result;
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
      // Read time after acquiring the lock, so a queued delivery cannot beat expiry.
      const now = new Date();
      const farm = await advanceFarmLifecycle(tx, loaded, now);
      const { board, window } = await loadBoard(tx, farm.id, now);
      if (!window.open || input.cycle !== window.cycle) return { reason: "expired" };
      const request = NPC_REQUESTS[board.brewer ? "brewer" : "starter"][input.slot];
      if (!request) return { reason: "expired" };
      if (board.completed.includes(input.slot)) return { snapshot: await readFarmSnapshot(tx, farm, false) };
      if (farm.version !== input.expectedFarmVersion) return { reason: "version_conflict" };
      const [duplicate] = await tx.select({ id: shekelTransactions.id }).from(shekelTransactions).where(and(
        eq(shekelTransactions.playerId, input.playerId), eq(shekelTransactions.idempotencyKey, input.idempotencyKey)
      ));
      if (duplicate) return { reason: "idempotency_conflict" };
      const barley = await loadMarketItemStorage(tx, farm.id, "barley", now);
      const beer = await loadMarketItemStorage(tx, farm.id, "beer", now);
      if (!canDeliverRequest(request, { barley: barley.storedQuantity, beer: beer.storedQuantity })) return { reason: "insufficient_goods" };
      const [player] = await tx.select().from(players).where(eq(players.id, input.playerId)).for("update");
      if (!player) return { reason: "missing_farm" };
      const balance = player.shekelBalance + request.reward;
      if (balance > 2_147_483_647) return { reason: "balance_limit" };
      if (request.barley > 0) await removeFromMarketItemStorage(tx, barley, request.barley, now);
      if (request.beer > 0) await removeFromMarketItemStorage(tx, beer, request.beer, now);
      await tx.update(players).set({ shekelBalance: balance, updatedAt: now }).where(eq(players.id, player.id));
      await tx.insert(shekelTransactions).values({ playerId: player.id, idempotencyKey: input.idempotencyKey,
        type: "request_reward", requestCustomer: request.customer, delta: request.reward, balanceAfter: balance, createdAt: now });
      await tx.update(npcRequestBoards).set({ completed: [...board.completed, input.slot] }).where(eq(npcRequestBoards.farmId, farm.id));
      const [updated] = await tx.update(farms).set({ version: sql`${farms.version} + 1`, updatedAt: now }).where(eq(farms.id, farm.id)).returning();
      return { snapshot: await readFarmSnapshot(tx, updated!, false) };
    }),
    catch: cause => new NpcRequestPersistenceError({ cause })
  });
  return "reason" in outcome ? yield* Effect.fail(new NpcRequestRuleError({ reason: outcome.reason })) : outcome.snapshot;
});
