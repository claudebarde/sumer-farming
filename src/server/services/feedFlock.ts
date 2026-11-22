import { eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import type { z } from "zod";
import { FeedFlockSchema, FEED_BARLEY, FEED_STOP_MS, flockFeedDue } from "../../game-data/livestock";
import { feedLivestock } from "../../game-core/farm/livestock";
import { farmerSleepBlocker } from "../../game-core/farm/farmerSleep";
import { isFarmerSleeping } from "../../game-data/farmerSleep";
import { plantingTravelPath } from "../../game-core/farm/batchPlantingTravel";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../game-data/movement";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { Database } from "../db/client";
import { farms } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";
import { loadMarketItemStorage, removeFromMarketItemStorage } from "./marketItemStorage";

export class FeedFlockError extends Data.TaggedError("FeedFlockError")<{ readonly message: string }> {}
export class FeedFlockPersistenceError extends Data.TaggedError("FeedFlockPersistenceError")<{ readonly cause: unknown }> {}
export const feedFlock = (db: Database, playerId: string, input: z.infer<typeof FeedFlockSchema>) => Effect.tryPromise({
  try: () => db.transaction(async tx => {
    const fail = (message: string): never => { throw new FeedFlockError({ message }); };
    if (!FeedFlockSchema.safeParse(input).success) return fail("Invalid feeding request.");
    const [loaded] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
    if (!loaded) return fail("Farm not found.");
    const snapshot = await readFarmSnapshot(tx, loaded, false), now = Date.now();
    const state = snapshot.farm.production.livestock;
    if (state?.feeding?.id === input.idempotencyKey) return snapshot;
    if (loaded.version !== input.expectedFarmVersion) return fail("The farm changed. Please try again.");
    if (loaded.level < 12) return fail("Sheep care unlocks at level 12.");
    const pen = snapshot.buildings.find(b => b.id === input.penId && b.type === "sheepPen" && Date.parse(b.completesAt) <= now);
    if (!pen?.loadingTile || !state || !state.animals.length || state.animals.some(a => a.penId !== pen.id)) return fail("No flock in this pen.");
    if (!flockFeedDue(state, now)) return fail("The flock is not ready for feeding.");
    const blocker = farmerSleepBlocker(snapshot, now);
    if (isFarmerSleeping(snapshot.farm.sleep, now) || (blocker && blocker !== "No sleep time available yet.")) return fail("The farmer is busy.");
    const storage = await loadMarketItemStorage(tx, loaded.id, "barley", new Date(now));
    const quantity = state.animals.length * FEED_BARLEY;
    if (storage.storedQuantity < quantity + 1) return fail(`Requires ${quantity} barley and one barley kept for planting.`);
    const path = [input.farmerPosition], pickups: { storageId: string; quantity: number; pickupAt: number }[] = [];
    const stepMs = WORKER_MOVE_DURATION_PER_TILE;
    let needed = quantity;
    for (const source of [{ id: "farm", quantity: storage.farmQuantity }, ...storage.granaries.map(g => ({ id: g.id, quantity: g.storedBarley }))]) {
      const take = Math.min(needed, source.quantity);
      if (!take) continue;
      const building = snapshot.buildings.find(b => b.id === source.id);
      const candidates = source.id === "farm" ? [INITIAL_FARM_CONFIG.farmerSpawn] : building ?
        [building.loadingTile, { column: building.column, row: building.row + 2 }, { column: building.column - 1, row: building.row }, { column: building.column + 2, row: building.row }, { column: building.column, row: building.row - 1 }] : [];
      const route = candidates.map(p => p ? plantingTravelPath(snapshot, path.at(-1)!, p, now) : null).find(p => p !== null);
      if (!route) return fail("The barley storage cannot be reached.");
      path.push(...route.slice(1));
      pickups.push({ storageId: source.id, quantity: take, pickupAt: now + (path.length - 1) * stepMs });
      needed -= take;
      if (!needed) break;
    }
    const route = plantingTravelPath(snapshot, path.at(-1)!, pen.loadingTile, now);
    if (!route) return fail("The sheep pen cannot be reached.");
    path.push(...route.slice(1));
    const completesAt = now + (path.length - 1) * stepMs + FEED_STOP_MS;
    const feeding = { id: input.idempotencyKey, penId: pen.id, startedAt: now, completesAt, stepMs, path, pickups };
    // Reserve once, expose the saved pickups separately for physical-stock visuals.
    await removeFromMarketItemStorage(tx, storage, quantity, new Date(now));
    const livestock = { ...feedLivestock(state, completesAt, now), feeding };
    const [saved] = await tx.update(farms).set({ production: { ...snapshot.farm.production, livestock }, version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, loaded.id)).returning();
    return readFarmSnapshot(tx, saved!, false);
  }),
  catch: cause => cause instanceof FeedFlockError ? cause : new FeedFlockPersistenceError({ cause })
});
