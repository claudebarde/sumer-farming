import { and, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { buildingLevel, BUILDING_UPGRADES } from "../../game-data/buildingUpgrades";
import { buildingUpgradeUnavailableReason } from "../../game-core/farm/buildingUpgrades";
import type { GameCommand } from "../../schemas/gameCommands";
import type { Database } from "../db/client";
import { farms, players, shekelTransactions } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";

export class BuildingUpgradeRuleError extends Data.TaggedError("BuildingUpgradeRuleError")<{ readonly message: string }> {}
export class BuildingUpgradePersistenceError extends Data.TaggedError("BuildingUpgradePersistenceError")<{ readonly cause: unknown }> {}

export const upgradeBuilding = (db: Database, input: Extract<GameCommand, { type: "upgrade_building" }> & { playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({ try: () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
    if (!record) return new BuildingUpgradeRuleError({ message: "Farm not found." });
    const [previous] = await tx.select().from(shekelTransactions).where(and(eq(shekelTransactions.playerId, input.playerId), eq(shekelTransactions.idempotencyKey, input.idempotencyKey)));
    if (previous) {
      const matching = record.production.buildingUpgrades?.[input.buildingId]?.some(u => u.idempotencyKey === input.idempotencyKey && u.level === input.targetLevel);
      return previous.type === "building_upgrade" && matching ? readFarmSnapshot(tx, record, false)
        : new BuildingUpgradeRuleError({ message: "This payment key has already been used for another action." });
    }
    if (record.version !== input.expectedFarmVersion) return new BuildingUpgradeRuleError({ message: "The farm changed. Please try again." });
    const snapshot = await readFarmSnapshot(tx, record, false);
    const now = Date.now();
    const reason = buildingUpgradeUnavailableReason(snapshot, input.buildingId, now);
    if (reason) return new BuildingUpgradeRuleError({ message: reason });
    const building = snapshot.buildings.find(b => b.id === input.buildingId)!;
    const upgrades = snapshot.farm.production.buildingUpgrades ?? {};
    const nextLevel = buildingLevel(upgrades, building.id, now) + 1;
    if (input.targetLevel !== nextLevel) return new BuildingUpgradeRuleError({ message: "Upgrade one building level at a time." });
    const upgrade = BUILDING_UPGRADES[building.type]![nextLevel]!;
    const [player] = await tx.select().from(players).where(eq(players.id, input.playerId)).for("update");
    if (!player || player.shekelBalance < upgrade.cost) return new BuildingUpgradeRuleError({ message: "Not enough shekels." });
    const balanceAfter = player.shekelBalance - upgrade.cost;
    await tx.update(players).set({ shekelBalance: balanceAfter }).where(eq(players.id, input.playerId));
    await tx.insert(shekelTransactions).values({ playerId: input.playerId, idempotencyKey: input.idempotencyKey, type: "building_upgrade", delta: -upgrade.cost, balanceAfter });
    const [updated] = await tx.update(farms).set({
      production: { ...snapshot.farm.production, buildingUpgrades: { ...upgrades, [building.id]: [...(upgrades[building.id] ?? []), {
        level: nextLevel, startedAt: new Date(now).toISOString(), completesAt: new Date(now + upgrade.durationMs).toISOString(), idempotencyKey: input.idempotencyKey
      }] } }, version: sql`${farms.version} + 1`, updatedAt: new Date(now)
    }).where(eq(farms.id, record.id)).returning();
    return readFarmSnapshot(tx, updated!, false);
  }), catch: cause => new BuildingUpgradePersistenceError({ cause }) });
  return result instanceof BuildingUpgradeRuleError ? yield* Effect.fail(result) : result;
});
