import { eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import type { z } from "zod";
import { ShearFlockSchema, readySheep, SHEAR_MS, WOOL_PER_SHEEP, WOOL_REGROW_MS } from "../../game-data/livestock";
import { farmerSleepBlocker } from "../../game-core/farm/farmerSleep";
import { isFarmerSleeping } from "../../game-data/farmerSleep";
import { plantingTravelPath } from "../../game-core/farm/batchPlantingTravel";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../game-data/movement";
import type { Database } from "../db/client";
import { farms } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";
export class ShearFlockError extends Data.TaggedError("ShearFlockError")<{ readonly message: string }> {}
export class ShearFlockPersistenceError extends Data.TaggedError("ShearFlockPersistenceError")<{ readonly cause: unknown }> {}
export const shearFlock = (db: Database, playerId: string, input: z.infer<typeof ShearFlockSchema>) => Effect.tryPromise({
  try: () => db.transaction(async tx => {
    const fail = (message: string): never => { throw new ShearFlockError({ message }); };
    if (!ShearFlockSchema.safeParse(input).success) return fail("Invalid shearing request.");
    const [loaded] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
    if (!loaded) return fail("Farm not found.");
    const snapshot = await readFarmSnapshot(tx, loaded, false), now = Date.now();
    const state = snapshot.farm.production.livestock;
    if (state?.shearing?.id === input.idempotencyKey) return snapshot;
    if (loaded.version !== input.expectedFarmVersion) return fail("The farm changed. Please try again.");
    if (loaded.level < 12) return fail("Shearing unlocks at level 12.");
    const pen = snapshot.buildings.find(b => b.id === input.penId && b.type === "sheepPen" && Date.parse(b.completesAt) <= now);
    if (!pen?.loadingTile || !state) return fail("No completed sheep pen.");
    const ready = readySheep(state, now).filter(a => a.penId === pen.id);
    if (!ready.length) return fail("No wool is ready.");
    if (state.animals.some(a => !a.care || a.care.needsFeedAt <= now)) return fail("Feed the flock first.");
    const blocker = farmerSleepBlocker(snapshot, now);
    if (isFarmerSleeping(snapshot.farm.sleep, now) || (blocker && blocker !== "No sleep time available yet.")) return fail("The farmer is busy.");
    const quantity = ready.length * WOOL_PER_SHEEP;
    const warehouse = snapshot.buildings.find(b => b.type === "warehouse" && Date.parse(b.completesAt) <= now);
    if (!warehouse || (snapshot.inventory.find(i => i.itemKey === "wool")?.quantity ?? 0) + quantity > 12) return fail(`Need space for ${quantity} wool in the warehouse.`);
    const outbound = plantingTravelPath(snapshot, input.farmerPosition, pen.loadingTile, now);
    if (!outbound) return fail("The sheep pen cannot be reached.");
    const candidates = [warehouse.loadingTile, { column: warehouse.column, row: warehouse.row + 2 }, { column: warehouse.column - 1, row: warehouse.row }, { column: warehouse.column + 2, row: warehouse.row }, { column: warehouse.column, row: warehouse.row - 1 }];
    const inbound = candidates.map(cell => cell ? plantingTravelPath(snapshot, pen.loadingTile!, cell, now) : null).find(route => route !== null);
    if (!inbound) return fail("The warehouse cannot be reached.");
    const stepMs = WORKER_MOVE_DURATION_PER_TILE;
    const shearsAt = now + (outbound.length - 1) * stepMs;
    const shearedAt = shearsAt + ready.length * SHEAR_MS;
    const completesAt = shearedAt + (inbound.length - 1) * stepMs + 3000;
    const shearing = { id: input.idempotencyKey, penId: pen.id, animalIds: ready.map(a => a.id), quantity, warehouseId: warehouse.id, startedAt: now, shearsAt, shearedAt, completesAt, stepMs, outbound: [...outbound], inbound: [...inbound], settled: false };
    const livestock = { ...state, shearing, fleece: { remainingMs: WOOL_REGROW_MS, updatedAt: shearedAt } };
    const [saved] = await tx.update(farms).set({ production: { ...snapshot.farm.production, livestock }, version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, loaded.id)).returning();
    return readFarmSnapshot(tx, saved!, false);
  }),
  catch: cause => cause instanceof ShearFlockError ? cause : new ShearFlockPersistenceError({ cause })
});
