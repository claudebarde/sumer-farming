import { and, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { PORTER_COST, PORTER_HIRE_MS } from "../../game-data/porter";
import { PORTER_HOME } from "../../game-core/farm/porter";
import type { GameCommand } from "../../schemas/gameCommands";
import type { Database } from "../db/client";
import { farms, players, shekelTransactions } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";

export class PorterRuleError extends Data.TaggedError("PorterRuleError")<{ readonly message: string }> {}
export class PorterPersistenceError extends Data.TaggedError("PorterPersistenceError")<{ readonly cause: unknown }> {}
export const hirePorter = (db: Database, input: Extract<GameCommand, { type: "hire_porter" }> & { playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({ try: () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
    if (!record) return new PorterRuleError({ message: "Farm not found." });
    const [previous] = await tx.select().from(shekelTransactions).where(and(eq(shekelTransactions.playerId, input.playerId), eq(shekelTransactions.idempotencyKey, input.idempotencyKey)));
    if (previous) return previous.type === "porter_hire" ? readFarmSnapshot(tx, record, false) : new PorterRuleError({ message: "This payment key has already been used." });
    if (record.version !== input.expectedFarmVersion) return new PorterRuleError({ message: "The farm changed. Please try again." });
    const now = Date.now();
    const farm = await advanceFarmLifecycle(tx, record, new Date(now));
    if (farm.level < 5) return new PorterRuleError({ message: "Unlock at level 5." });
    if (farm.production.porter && (farm.production.porter.expiresAt > now || farm.production.porter.job)) return new PorterRuleError({ message: "The porter is already hired or finishing his last delivery." });
    const [player] = await tx.select().from(players).where(eq(players.id, input.playerId)).for("update");
    if (!player || player.shekelBalance < PORTER_COST) return new PorterRuleError({ message: "Not enough shekels." });
    const balanceAfter = player.shekelBalance - PORTER_COST;
    await tx.update(players).set({ shekelBalance: balanceAfter }).where(eq(players.id, input.playerId));
    await tx.insert(shekelTransactions).values({ playerId: input.playerId, idempotencyKey: input.idempotencyKey, type: "porter_hire", delta: -PORTER_COST, balanceAfter });
    const [updated] = await tx.update(farms).set({ production: { ...farm.production, porter: { hiredAt: now, expiresAt: now + PORTER_HIRE_MS, checkedAt: now, position: PORTER_HOME, job: null } }, version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, farm.id)).returning();
    return readFarmSnapshot(tx, updated!, false);
  }), catch: cause => new PorterPersistenceError({ cause }) });
  return result instanceof PorterRuleError ? yield* Effect.fail(result) : result;
});
