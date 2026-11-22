import { isFarmerSleeping } from "../../game-data/farmerSleep";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { BuyLambsSchema, emptyLivestock, FEED_PERIOD_MS, LAMB_PRICE, lambPurchaseLimit } from "../../game-data/livestock";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../game-data/movement";
import { FARM_MARKET_ENTRANCE } from "../../game-data/farmMarket";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { porterPath } from "../../game-core/farm/porter";
import { farmerSleepBlocker } from "../../game-core/farm/farmerSleep";
import type { z } from "zod";
import type { Database } from "../db/client";
import { farms, players, shekelTransactions } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";

export class LambPurchaseError extends Data.TaggedError("LambPurchaseError")<{ readonly message: string }> {}
export class LambPurchasePersistenceError extends Data.TaggedError("LambPurchasePersistenceError")<{ readonly cause: unknown }> {}
export const buyLambs = (db: Database, playerId: string, input: z.infer<typeof BuyLambsSchema>) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({ try: () => db.transaction(async tx => {
    if (!BuyLambsSchema.safeParse(input).success) return new LambPurchaseError({ message: "Choose between one and three lambs." });
    const [farm] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
    if (!farm) return new LambPurchaseError({ message: "Farm not found." });
    const snapshot = await readFarmSnapshot(tx, farm, false);
    const state = snapshot.farm.production.livestock ?? emptyLivestock();
    const [receipt] = await tx.select().from(shekelTransactions).where(and(eq(shekelTransactions.playerId, playerId), eq(shekelTransactions.idempotencyKey, input.idempotencyKey)));
    if (receipt) return receipt.type === "livestock_purchase" && receipt.delta === -input.quantity * LAMB_PRICE ? snapshot : new LambPurchaseError({ message: "This purchase reference has already been used." });
    if (farm.version !== input.expectedFarmVersion) return new LambPurchaseError({ message: "The farm changed. Please try again." });
    if (farm.level < 12) return new LambPurchaseError({ message: "Lambs unlock at level 12." });
    const now = Date.now();
    const pen = snapshot.buildings.find(b => b.type === "sheepPen" && Date.parse(b.completesAt) <= now);
    if (!pen?.loadingTile) return new LambPurchaseError({ message: "Build a sheep pen first." });
    const blocker = farmerSleepBlocker(snapshot, now);
    if (blocker && blocker !== "No sleep time available yet.") return new LambPurchaseError({ message: blocker });
    if (isFarmerSleeping(farm.sleep, now)) return new LambPurchaseError({ message: "Wake the farmer first." });
    const [player] = await tx.select().from(players).where(eq(players.id, playerId)).for("update");
    if (!player || input.quantity > lambPurchaseLimit(state.animals.length, player.shekelBalance)) return new LambPurchaseError({ message: state.animals.length + input.quantity > 3 ? "There is not enough space in the pen." : "Not enough shekels." });
    const farmPath = porterPath(snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) })), snapshot.farm.roads, FARM_MARKET_ENTRANCE, pen.loadingTile, now, snapshot.objects);
    if (!farmPath) return new LambPurchaseError({ message: "Connect the sheep pen to the market road." });
    // The supplies merchant stands on the main market road. Save both journeys.
    const marketPath = Array.from({ length: 14 }, (_, i) => ({ column: 11 - i, row: INITIAL_FARM_CONFIG.roadRow }));
    const stepMs = WORKER_MOVE_DURATION_PER_TILE;
    const farmStartsAt = now + (marketPath.length - 1 + input.quantity) * stepMs;
    const completesAt = farmStartsAt + (farmPath.length - 1 + input.quantity + 2) * stepMs;
    const delivery = { id: input.idempotencyKey, penId: pen.id, quantity: input.quantity, startedAt: now, farmStartsAt, completesAt, stepMs, marketPath, farmPath: [...farmPath] };
    const animals = Array.from({ length: input.quantity }, () => ({ id: randomUUID(), purchaseId: input.idempotencyKey, penId: pen.id, age: "lamb" as const, purchasedAt: now, arrivesAt: completesAt, care: { growthMs: 0, fedAt: null, needsFeedAt: Math.max(completesAt, ...(state.animals.map(a => a.care?.needsFeedAt ?? 0)), state.feeding ? state.feeding.completesAt + FEED_PERIOD_MS : 0) } }));
    const balance = player.shekelBalance - input.quantity * LAMB_PRICE;
    await tx.update(players).set({ shekelBalance: balance }).where(eq(players.id, playerId));
    await tx.insert(shekelTransactions).values({ playerId, type: "livestock_purchase", source: "npc", delta: -input.quantity * LAMB_PRICE, balanceAfter: balance, idempotencyKey: input.idempotencyKey });
    const [saved] = await tx.update(farms).set({ production: { ...snapshot.farm.production, livestock: { ...state, animals: [...state.animals, ...animals], delivery } }, version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, farm.id)).returning();
    return readFarmSnapshot(tx, saved!, false);
  }), catch: cause => new LambPurchasePersistenceError({ cause }) });
  return result instanceof LambPurchaseError ? yield* Effect.fail(result) : result;
});
