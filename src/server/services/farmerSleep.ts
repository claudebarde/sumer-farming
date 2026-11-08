import { eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { randomUUID } from "node:crypto";
import type { Database } from "../db/client";
import { farms } from "../db/schema";
import type { GameCommand } from "../../schemas/gameCommands";
import { ProductionRuleError, ProductionPersistenceError } from "./production";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { farmerSleepBlocker } from "../../game-core/farm/farmerSleep";
import { isFarmerSleeping, sleepEnd, sleepIntervals, sleepRemaining, SLEEP_ENTRY_MS, SLEEP_HOME, SLEEP_WINDOW_MS } from "../../game-data/farmerSleep";
import { porterPath } from "../../game-core/farm/porter";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../game-data/movement";

/** Serialized with all player commands by the request's advisory lock; farm lock
 * also protects against lifecycle reads and independent porter deliveries. */
export const farmerSleepAction = (database: Database, input: Extract<GameCommand, { type: "farmer_sleep" }> & { playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({ try: () => database.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
    if (!record) return new ProductionRuleError({ message: "The farm does not exist." });
    const now = Date.now();
    const farm = await advanceFarmLifecycle(tx, record, new Date(now));
    if (isFarmerSleeping(farm.sleep, now) && input.action === "sleep") return readFarmSnapshot(tx, farm, false);
    if (farm.version !== input.expectedFarmVersion) return new ProductionRuleError({ message: "The farm changed. Please try again." });
    if (input.action === "wake") {
      if (!isFarmerSleeping(farm.sleep, now)) return readFarmSnapshot(tx, farm, false);
      const [updated] = await tx.update(farms).set({ sleep: { ...farm.sleep, session: { ...farm.sleep.session!, wokeAt: now } }, version: sql`${farms.version} + 1` }).where(eq(farms.id, farm.id)).returning();
      return readFarmSnapshot(tx, updated!, false);
    }
    const snapshot = await readFarmSnapshot(tx, farm, false);
    const blocker = farmerSleepBlocker(snapshot, now);
    if (blocker) return new ProductionRuleError({ message: blocker });
    const buildings = snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) }));
    const obstacles = [...snapshot.objects, ...snapshot.improvements];
    const route = (from: typeof SLEEP_HOME, to: typeof SLEEP_HOME) => porterPath(buildings, farm.roads, from, to, now, obstacles);
    const hint = input.farmerPosition && route(SLEEP_HOME, input.farmerPosition) ? input.farmerPosition : SLEEP_HOME;
    const path = route(hint, SLEEP_HOME);
    if (!path) return new ProductionRuleError({ message: "The farmer cannot reach the farmhouse." });
    const sleepsAt = now + (path.length - 1) * WORKER_MOVE_DURATION_PER_TILE + SLEEP_ENTRY_MS;
    const history = sleepIntervals(farm.sleep).filter(s => s.end > Math.min(now - SLEEP_WINDOW_MS, farm.happinessCheckedAt.getTime()));
    const endsAt = sleepsAt + sleepRemaining({ history: [...history], session: null }, sleepsAt);
    const sleep = { history: [...history], session: { id: randomUUID(), requestedAt: now, sleepsAt, endsAt, wokeAt: null, path: [...path] } };
    const [updated] = await tx.update(farms).set({ sleep, version: sql`${farms.version} + 1` }).where(eq(farms.id, farm.id)).returning();
    return readFarmSnapshot(tx, updated!, false);
  }), catch: cause => new ProductionPersistenceError({ cause }) });
  return result instanceof ProductionRuleError ? yield* Effect.fail(result) : result;
});

/** Wake on user commands, never background completion acknowledgements. */
export const commandWakesFarmer = (command: GameCommand): boolean => command.type !== "farmer_sleep" &&
  command.type !== "advance_batch_planting" && command.type !== "complete_gather_resource" && command.type !== "complete_harvest_crop";
export const wakeForPlayerCommand = async (db: Database, playerId: string, command: GameCommand): Promise<GameCommand> => {
  if (!commandWakesFarmer(command)) return command;
  return db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
    if (!record || !isFarmerSleeping(record.sleep, Date.now())) return command;
    if ("expectedFarmVersion" in command && record.version !== command.expectedFarmVersion) return command;
    const now = Date.now(), farm = await advanceFarmLifecycle(tx, record, new Date(now));
    const [updated] = await tx.update(farms).set({ sleep: { ...farm.sleep, session: { ...farm.sleep.session!, wokeAt: Math.min(now, sleepEnd(farm.sleep.session!)) } }, version: sql`${farms.version} + 1` }).where(eq(farms.id, farm.id)).returning();
    const wakingCommand = "farmerPosition" in command ? { ...command, farmerPosition: SLEEP_HOME } : command;
    return "expectedFarmVersion" in wakingCommand ? { ...wakingCommand, expectedFarmVersion: updated!.version } : wakingCommand;
  });
};
