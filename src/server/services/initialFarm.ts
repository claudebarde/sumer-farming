import { eq } from "drizzle-orm";
import { Data, Effect } from "effect";

import { createInitialFarmPlan } from "../../game-core/farm/createInitialFarmPlan";
import { EXPOSED_BARLEY_LIFETIME_MS } from "../../game-data/household";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database } from "../db/client";
import {
  farmGroundItems,
  farmInventory,
  farmObjects,
  farms,
  players
} from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";

export const DEVELOPMENT_PLAYER = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Development Player"
} as const;

export class InitialFarmPersistenceError extends Data.TaggedError(
  "InitialFarmPersistenceError"
)<{
  readonly cause: unknown;
}> {}

export const ensureInitialFarm = (
  database: Database,
  playerId: string,
  seed: number
): Effect.Effect<FarmSnapshot, InitialFarmPersistenceError> =>
  Effect.tryPromise({
    try: () =>
      database.transaction(async transaction => {
        const [createdFarm] = await transaction
          .insert(farms)
          .values({ playerId })
          .onConflictDoNothing({ target: farms.playerId })
          .returning();

        const farm =
          createdFarm ??
          (
            await transaction
              .select()
              .from(farms)
              .where(eq(farms.playerId, playerId))
              .limit(1)
              .for("update")
          )[0];

        if (farm === undefined) {
          throw new Error("The farm could not be created or loaded");
        }

        if (createdFarm !== undefined) {
          const plan = createInitialFarmPlan(seed);

          if (plan.inventory.length > 0) {
            await transaction.insert(farmInventory).values(
              plan.inventory.map(entry => ({
                farmId: farm.id,
                itemKey: entry.itemKey,
                quantity: entry.quantity
              }))
            );
          }

          await transaction.insert(farmObjects).values(
            plan.objects.map(object => ({
              farmId: farm.id,
              type: object.type,
              column: object.column,
              row: object.row
            }))
          );

          await transaction.insert(farmGroundItems).values(
              plan.groundItems.map(item => ({
              farmId: farm.id,
              itemKey: item.itemKey,
              quantity: item.quantity,
              column: item.column,
                row: item.row,
                expiresAt:
                  item.itemKey === "barley"
                    ? new Date(Date.now() + EXPOSED_BARLEY_LIFETIME_MS)
                    : null
            }))
          );
        }

        return readFarmSnapshot(
          transaction,
          farm,
          createdFarm !== undefined
        );
      }),
    catch: cause => new InitialFarmPersistenceError({ cause })
  });

export const ensureDevelopmentFarm = (
  database: Database,
  seed: number
): Effect.Effect<FarmSnapshot, InitialFarmPersistenceError> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () =>
        database
          .insert(players)
          .values(DEVELOPMENT_PLAYER)
          .onConflictDoNothing({ target: players.id }),
      catch: cause => new InitialFarmPersistenceError({ cause })
    });

    return yield* ensureInitialFarm(database, DEVELOPMENT_PLAYER.id, seed);
  });
