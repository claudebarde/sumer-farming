// src/server/index.ts

import { Effect, Either } from "effect";
import { Hono } from "hono";
import { Client } from "pg";
import { match, P } from "ts-pattern";

import { GameCommandSchema } from "../schemas/gameCommands";
import type { FarmSnapshot } from "../schemas/farm";
import { getMarketQuotes } from "./services/marketQuotes";
import { describeBuildingPlacementRule } from "../game-core/farm/buildings";
import { createDatabase } from "./db/client";
import { players } from "./db/schema";
import {
  buildIrrigation,
  FarmVersionConflictError,
  InvalidIrrigationLocationError,
  IrrigationAlreadyExistsError,
  IrrigationFarmNotFoundError,
  IrrigationNotConnectedError,
  IrrigationPersistenceError,
  IrrigationTileOccupiedError,
  type BuildIrrigationError
} from "./services/buildIrrigation";
import {
  buildGranary,
  BuildGranaryPersistenceError,
  BuildGranaryRuleError,
  type BuildGranaryError
} from "./services/buildGranary";
import {
  destroyIrrigation,
  IrrigationAlreadyBeingDestroyedError,
  IrrigationDestructionPersistenceError,
  IrrigationHasDependentsError,
  IrrigationNotCompleteError,
  IrrigationNotFoundError,
  type DestroyIrrigationError
} from "./services/destroyIrrigation";
import {
  depositCarriedItem,
  depositCarriedItemInGranary,
  dropCarriedItem,
  FarmItemPersistenceError,
  FarmItemRuleError,
  pickupGroundItem,
  withdrawBarleyFromGranary,
  withdrawInventoryItem,
  type FarmItemActionError
} from "./services/farmItemActions";
import {
  completeHarvestCrop,
  HarvestCropPersistenceError,
  HarvestCropRuleError,
  startHarvestCrop,
  type HarvestCropError
} from "./services/harvestCrop";
import {
  completeGatherResource,
  GatherResourcePersistenceError,
  GatherResourceRuleError,
  startGatherResource,
  type GatherResourceError
} from "./services/gatherResource";
import {
  DEVELOPMENT_PLAYER,
  ensureDevelopmentFarm
} from "./services/initialFarm";
import {
  plantCrop,
  PlantCropPersistenceError,
  PlantCropRuleError,
  type PlantCropError
} from "./services/plantCrop";
import {
  buyFromNpcMarket,
  MarketTradePersistenceError,
  MarketTradeRuleError,
  sellToNpcMarket,
  type MarketTradeError
} from "./services/tradeMarketItem";

const app = new Hono<{ Bindings: Env }>();

type GameActionEffect = Effect.Effect<
  FarmSnapshot,
  | BuildIrrigationError
  | BuildGranaryError
  | DestroyIrrigationError
  | FarmItemActionError
  | GatherResourceError
  | HarvestCropError
  | PlantCropError
  | MarketTradeError
>;

app.get("/api/health", c => {
  return c.json({ ok: true });
});

app.get("/api/market/quotes", c => c.json(getMarketQuotes()));

app.get("/api/db/health", async c => {
  const client = new Client({
    connectionString: c.env.HYPERDRIVE.connectionString
  });

  try {
    await client.connect();

    const db = createDatabase(client);
    await db.select({ id: players.id }).from(players).limit(1);

    return c.json({ ok: true });
  } catch (error) {
    console.error("Database health check failed", error);

    return c.json({ ok: false }, 503);
  } finally {
    await client.end().catch(error => {
      console.error("Failed to close database connection", error);
    });
  }
});

app.post("/api/development/farm", async c => {
  if (!import.meta.env.DEV) {
    return c.notFound();
  }

  const client = new Client({
    connectionString: c.env.HYPERDRIVE.connectionString
  });

  try {
    await client.connect();

    const database = createDatabase(client);
    const randomSeed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
    const result = await Effect.runPromise(
      Effect.either(ensureDevelopmentFarm(database, randomSeed))
    );

    if (Either.isLeft(result)) {
      console.error("Development farm bootstrap failed", result.left);

      return c.json({ ok: false }, 500);
    }

    return c.json(result.right);
  } catch (error) {
    console.error("Development farm connection failed", error);

    return c.json({ ok: false }, 503);
  } finally {
    await client.end().catch(error => {
      console.error("Failed to close database connection", error);
    });
  }
});

app.post("/api/game/action", async c => {
  if (!import.meta.env.DEV) {
    return c.notFound();
  }

  const requestBody = await c.req.json().catch(() => undefined);
  const parsedCommand = GameCommandSchema.safeParse(requestBody);

  if (!parsedCommand.success) {
    return c.json(
      {
        error: {
          type: "invalid_command",
          message: "The game command is invalid"
        }
      },
      400
    );
  }

  const client = new Client({
    connectionString: c.env.HYPERDRIVE.connectionString
  });

  try {
    await client.connect();

    const database = createDatabase(client);
    const result = await Effect.runPromise(
      Effect.either(
        match(parsedCommand.data)
          .returnType<GameActionEffect>()
          .with({ type: "build_irrigation" }, command =>
            buildIrrigation(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "build_granary" }, command =>
            buildGranary(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "destroy_irrigation" }, command =>
            destroyIrrigation(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "plant_crop" }, command =>
            plantCrop(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              crop: command.crop,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "start_harvest_crop" }, command =>
            startHarvestCrop(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "complete_harvest_crop" }, command =>
            completeHarvestCrop(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "start_gather_resource" }, command =>
            startGatherResource(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              itemKey: command.itemKey,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "complete_gather_resource" }, command =>
            completeGatherResource(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "pickup_ground_item" }, command =>
            pickupGroundItem(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "drop_carried_item" }, command =>
            dropCarriedItem(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "deposit_carried_item" }, command =>
            depositCarriedItem(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "deposit_carried_item_in_granary" }, command =>
            depositCarriedItemInGranary(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "withdraw_inventory_item" }, command =>
            withdrawInventoryItem(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              itemKey: command.itemKey,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "withdraw_barley_from_granary" }, command =>
            withdrawBarleyFromGranary(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "buy_from_npc_market" }, command =>
            buyFromNpcMarket(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              itemKey: command.itemKey,
              quantity: command.quantity,
              expectedUnitPrice: command.expectedUnitPrice,
              idempotencyKey: command.idempotencyKey,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "sell_to_npc_market" }, command =>
            sellToNpcMarket(database, {
              playerId: DEVELOPMENT_PLAYER.id,
              itemKey: command.itemKey,
              quantity: command.quantity,
              expectedUnitPrice: command.expectedUnitPrice,
              idempotencyKey: command.idempotencyKey,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .exhaustive()
      )
    );

    if (Either.isRight(result)) {
      return c.json(result.right);
    }

    return match(result.left)
      .with(P.instanceOf(IrrigationFarmNotFoundError), () =>
        c.json(
          {
            error: {
              type: "farm_not_found",
              message: "The farm does not exist"
            }
          },
          404
        )
      )
      .with(P.instanceOf(FarmVersionConflictError), error =>
        c.json(
          {
            error: {
              type: "farm_version_conflict",
              message: "The farm changed before this command was applied",
              actualVersion: error.actualVersion
            }
          },
          409
        )
      )
      .with(P.instanceOf(InvalidIrrigationLocationError), error =>
        c.json(
          {
            error: {
              type: "invalid_irrigation_location",
              message: `An irrigation canal cannot be built here: ${error.reason}`
            }
          },
          422
        )
      )
      .with(P.instanceOf(IrrigationNotConnectedError), () =>
        c.json(
          {
            error: {
              type: "irrigation_not_connected",
              message:
                "A canal must connect to the river or a completed canal"
            }
          },
          422
        )
      )
      .with(P.instanceOf(IrrigationTileOccupiedError), () =>
        c.json(
          {
            error: {
              type: "irrigation_tile_occupied",
              message: "The tile is occupied"
            }
          },
          409
        )
      )
      .with(P.instanceOf(IrrigationAlreadyExistsError), () =>
        c.json(
          {
            error: {
              type: "irrigation_already_exists",
              message: "An irrigation canal already exists on this tile"
            }
          },
          409
        )
      )
      .with(P.instanceOf(IrrigationPersistenceError), error => {
        console.error("Irrigation command failed", error.cause);

        return c.json(
          {
            error: {
              type: "irrigation_persistence_failed",
              message: "The irrigation canal could not be saved"
            }
          },
          500
        );
      })
      .with(P.instanceOf(BuildGranaryRuleError), error =>
        match(error.rule)
          .with({ type: "farm_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "farm_not_found",
                  message: "The farm does not exist"
                }
              },
              404
            )
          )
          .with({ type: "version_conflict" }, rule =>
            c.json(
              {
                error: {
                  type: "farm_version_conflict",
                  message: "The farm changed before this command was applied",
                  actualVersion: rule.actualVersion
                }
              },
              409
            )
          )
          .with({ type: "farmer_busy" }, () =>
            c.json(
              {
                error: {
                  type: "farmer_busy",
                  message: "The farmer is already performing another action"
                }
              },
              409
            )
          )
          .with(
            { type: "outside_arable_plot" },
            { type: "footprint_occupied" },
            { type: "hands_not_empty" },
            { type: "missing_material" },
            rule =>
              c.json(
                {
                  error: {
                    type: `invalid_granary_${rule.type}`,
                    message: describeBuildingPlacementRule(rule)
                  }
                },
                422
              )
          )
          .exhaustive()
      )
      .with(P.instanceOf(BuildGranaryPersistenceError), error => {
        console.error("Granary construction failed", error.cause);

        return c.json(
          {
            error: {
              type: "granary_persistence_failed",
              message: "The granary construction could not be saved"
            }
          },
          500
        );
      })
      .with(P.instanceOf(IrrigationNotFoundError), () =>
        c.json(
          {
            error: {
              type: "irrigation_not_found",
              message: "There is no irrigation canal on this tile"
            }
          },
          404
        )
      )
      .with(P.instanceOf(IrrigationNotCompleteError), () =>
        c.json(
          {
            error: {
              type: "irrigation_not_complete",
              message: "This irrigation canal is still being built"
            }
          },
          409
        )
      )
      .with(P.instanceOf(IrrigationAlreadyBeingDestroyedError), () =>
        c.json(
          {
            error: {
              type: "irrigation_already_being_destroyed",
              message: "This irrigation canal is already being destroyed"
            }
          },
          409
        )
      )
      .with(P.instanceOf(IrrigationHasDependentsError), () =>
        c.json(
          {
            error: {
              type: "irrigation_has_dependents",
              message:
                "This canal cannot be destroyed while other canals depend on it"
            }
          },
          422
        )
      )
      .with(P.instanceOf(IrrigationDestructionPersistenceError), error => {
        console.error("Irrigation destruction failed", error.cause);

        return c.json(
          {
            error: {
              type: "irrigation_destruction_persistence_failed",
              message: "The irrigation canal could not be destroyed"
            }
          },
          500
        );
      })
      .with(P.instanceOf(FarmItemRuleError), error =>
        match(error.rule)
          .with({ type: "farm_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "farm_not_found",
                  message: "The farm does not exist"
                }
              },
              404
            )
          )
          .with({ type: "version_conflict" }, rule =>
            c.json(
              {
                error: {
                  type: "farm_version_conflict",
                  message: "The farm changed before this command was applied",
                  actualVersion: rule.actualVersion
                }
              },
              409
            )
          )
          .with({ type: "carrying_capacity_reached" }, () =>
            c.json(
              {
                error: {
                  type: "carrying_capacity_reached",
                  message: "The farmer cannot carry any more items"
                }
              },
              409
            )
          )
          .with({ type: "incompatible_carried_item" }, () =>
            c.json(
              {
                error: {
                  type: "incompatible_carried_item",
                  message: "The farmer is carrying a different item"
                }
              },
              409
            )
          )
          .with({ type: "farmer_hands_not_empty" }, () =>
            c.json(
              {
                error: {
                  type: "farmer_hands_not_empty",
                  message: "The farmer must empty their hands first"
                }
              },
              409
            )
          )
          .with({ type: "ground_item_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "ground_item_not_found",
                  message: "There is no item on this tile"
                }
              },
              404
            )
          )
          .with({ type: "not_carrying" }, () =>
            c.json(
              {
                error: {
                  type: "not_carrying",
                  message: "The farmer is not carrying an item"
                }
              },
              409
            )
          )
          .with({ type: "outside_arable_plot" }, () =>
            c.json(
              {
                error: {
                  type: "outside_arable_plot",
                  message: "Items can only be dropped on arable land"
                }
              },
              422
            )
          )
          .with({ type: "ground_tile_occupied" }, () =>
            c.json(
              {
                error: {
                  type: "ground_tile_occupied",
                  message: "This arable tile is occupied"
                }
              },
              409
            )
          )
          .with({ type: "farm_storage_full" }, () =>
            c.json(
              {
                error: {
                  type: "farm_storage_full",
                  message: "The farm storage is full"
                }
              },
              409
            )
          )
          .with({ type: "granary_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "granary_not_found",
                  message: "The granary does not exist"
                }
              },
              404
            )
          )
          .with({ type: "granary_not_complete" }, () =>
            c.json(
              {
                error: {
                  type: "granary_not_complete",
                  message: "The granary is still under construction"
                }
              },
              409
            )
          )
          .with({ type: "granary_storage_full" }, () =>
            c.json(
              {
                error: {
                  type: "granary_storage_full",
                  message: "The granary is full"
                }
              },
              409
            )
          )
          .with({ type: "granary_empty" }, () =>
            c.json(
              {
                error: {
                  type: "granary_empty",
                  message: "The granary is empty"
                }
              },
              409
            )
          )
          .with({ type: "granary_stores_barley_only" }, () =>
            c.json(
              {
                error: {
                  type: "granary_stores_barley_only",
                  message: "The granary can only store barley"
                }
              },
              409
            )
          )
          .with({ type: "inventory_item_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "inventory_item_not_found",
                  message: "This item is not stored in the farm"
                }
              },
              404
            )
          )
          .exhaustive()
      )
      .with(P.instanceOf(FarmItemPersistenceError), error => {
        console.error("Farm item command failed", error.cause);

        return c.json(
          {
            error: {
              type: "farm_item_persistence_failed",
              message: "The item action could not be saved"
            }
          },
          500
        );
      })
      .with(P.instanceOf(GatherResourceRuleError), error =>
        match(error.rule)
          .with({ type: "farm_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "farm_not_found",
                  message: "The farm does not exist"
                }
              },
              404
            )
          )
          .with({ type: "version_conflict" }, rule =>
            c.json(
              {
                error: {
                  type: "farm_version_conflict",
                  message: "The farm changed before this command was applied",
                  actualVersion: rule.actualVersion
                }
              },
              409
            )
          )
          .with({ type: "hands_not_empty" }, () =>
            c.json(
              {
                error: {
                  type: "hands_not_empty",
                  message: "The farmer must have empty hands to gather resources"
                }
              },
              409
            )
          )
          .with({ type: "gathering_in_progress" }, () =>
            c.json(
              {
                error: {
                  type: "gathering_in_progress",
                  message: "The farmer is already gathering a resource"
                }
              },
              409
            )
          )
          .with({ type: "gathering_not_started" }, () =>
            c.json(
              {
                error: {
                  type: "gathering_not_started",
                  message: "No resource gathering action is in progress"
                }
              },
              409
            )
          )
          .with({ type: "gathering_not_complete" }, () =>
            c.json(
              {
                error: {
                  type: "gathering_not_complete",
                  message: "The resource gathering time has not elapsed"
                }
              },
              409
            )
          )
          .with({ type: "invalid_resource_location" }, () =>
            c.json(
              {
                error: {
                  type: "invalid_resource_location",
                  message: "Clay can only be collected from an empty tile beside the river"
                }
              },
              422
            )
          )
          .with({ type: "resource_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "resource_not_found",
                  message: "The resource is no longer available"
                }
              },
              404
            )
          )
          .exhaustive()
      )
      .with(P.instanceOf(GatherResourcePersistenceError), error => {
        console.error("Resource gathering command failed", error.cause);

        return c.json(
          {
            error: {
              type: "resource_gathering_persistence_failed",
              message: "The resource gathering action could not be saved"
            }
          },
          500
        );
      })
      .with(P.instanceOf(HarvestCropRuleError), error =>
        match(error.rule)
          .with({ type: "farm_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "farm_not_found",
                  message: "The farm does not exist"
                }
              },
              404
            )
          )
          .with({ type: "crop_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "crop_not_found",
                  message: "There is no crop on this tile"
                }
              },
              404
            )
          )
          .with({ type: "version_conflict" }, rule =>
            c.json(
              {
                error: {
                  type: "farm_version_conflict",
                  message: "The farm changed before this command was applied",
                  actualVersion: rule.actualVersion
                }
              },
              409
            )
          )
          .with({ type: "crop_not_ready" }, () =>
            c.json(
              {
                error: {
                  type: "crop_not_ready",
                  message: "The barley is not ripe yet"
                }
              },
              409
            )
          )
          .with({ type: "crop_already_harvesting" }, () =>
            c.json(
              {
                error: {
                  type: "crop_already_harvesting",
                  message: "This crop is already being harvested"
                }
              },
              409
            )
          )
          .with({ type: "harvest_in_progress" }, () =>
            c.json(
              {
                error: {
                  type: "harvest_in_progress",
                  message: "The farmer is already harvesting another crop"
                }
              },
              409
            )
          )
          .with({ type: "harvest_not_started" }, () =>
            c.json(
              {
                error: {
                  type: "harvest_not_started",
                  message: "This harvest has not started"
                }
              },
              409
            )
          )
          .with({ type: "harvest_not_complete" }, () =>
            c.json(
              {
                error: {
                  type: "harvest_not_complete",
                  message: "The harvesting time has not elapsed"
                }
              },
              409
            )
          )
          .with({ type: "hands_not_empty" }, () =>
            c.json(
              {
                error: {
                  type: "hands_not_empty",
                  message: "The farmer must have empty hands to harvest"
                }
              },
              409
            )
          )
          .exhaustive()
      )
      .with(P.instanceOf(HarvestCropPersistenceError), error => {
        console.error("Harvest command failed", error.cause);

        return c.json(
          {
            error: {
              type: "harvest_persistence_failed",
              message: "The harvest could not be saved"
            }
          },
          500
        );
      })
      .with(P.instanceOf(PlantCropRuleError), error =>
        match(error.rule)
          .with({ type: "farm_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "farm_not_found",
                  message: "The farm does not exist"
                }
              },
              404
            )
          )
          .with({ type: "version_conflict" }, rule =>
            c.json(
              {
                error: {
                  type: "farm_version_conflict",
                  message: "The farm changed before this command was applied",
                  actualVersion: rule.actualVersion
                }
              },
              409
            )
          )
          .with({ type: "outside_arable_plot" }, () =>
            c.json(
              {
                error: {
                  type: "outside_arable_plot",
                  message: "Crops can only be planted on arable land"
                }
              },
              422
            )
          )
          .with({ type: "tile_occupied" }, () =>
            c.json(
              {
                error: {
                  type: "cultivation_tile_occupied",
                  message: "This tile is already occupied"
                }
              },
              409
            )
          )
          .with({ type: "missing_seed" }, rule =>
            c.json(
              {
                error: {
                  type: "missing_seed",
                  message: `The farmer must be carrying ${rule.requiredItem}`
                }
              },
              409
            )
          )
          .with({ type: "not_irrigated" }, () =>
            c.json(
              {
                error: {
                  type: "not_irrigated",
                  message:
                    "The arable tile must be next to a canal connected to the river"
                }
              },
              422
            )
          )
          .exhaustive()
      )
      .with(P.instanceOf(PlantCropPersistenceError), error => {
        console.error("Crop planting failed", error.cause);

        return c.json(
          {
            error: {
              type: "crop_planting_persistence_failed",
              message: "The crop could not be planted"
            }
          },
          500
        );
      })
      .with(P.instanceOf(MarketTradeRuleError), error =>
        match(error.rule)
          .with({ type: "farm_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "farm_not_found",
                  message: "The farm does not exist"
                }
              },
              404
            )
          )
          .with({ type: "player_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "player_not_found",
                  message: "The player does not exist"
                }
              },
              404
            )
          )
          .with({ type: "version_conflict" }, rule =>
            c.json(
              {
                error: {
                  type: "farm_version_conflict",
                  message: "The farm changed before this trade was applied",
                  actualVersion: rule.actualVersion
                }
              },
              409
            )
          )
          .with({ type: "insufficient_stored_item" }, rule =>
            c.json(
              {
                error: {
                  type: "insufficient_stored_item",
                  message: `Only ${rule.available} stored ${rule.itemKey} is available to sell`
                }
              },
              409
            )
          )
          .with({ type: "insufficient_shekels" }, rule =>
            c.json(
              {
                error: {
                  type: "insufficient_shekels",
                  message: `This purchase costs ${rule.required} shekels, but only ${rule.available} are available`
                }
              },
              409
            )
          )
          .with({ type: "insufficient_storage" }, rule =>
            c.json(
              {
                error: {
                  type: "insufficient_storage",
                  message: `Only ${rule.available} ${rule.itemKey} storage spaces are available`
                }
              },
              409
            )
          )
          .with({ type: "price_changed" }, rule =>
            c.json(
              {
                error: {
                  type: "market_price_changed",
                  message: `The price changed to ${rule.currentUnitPrice} shekels; review the new quote before trading`
                }
              },
              409
            )
          )
          .with({ type: "trade_unavailable" }, rule =>
            c.json(
              {
                error: {
                  type: "market_trade_unavailable",
                  message: `${rule.itemKey} is not currently available to ${rule.direction}`
                }
              },
              409
            )
          )
          .with({ type: "idempotency_conflict" }, () =>
            c.json(
              {
                error: {
                  type: "idempotency_conflict",
                  message: "This trade identifier was already used"
                }
              },
              409
            )
          )
          .exhaustive()
      )
      .with(P.instanceOf(MarketTradePersistenceError), error => {
        console.error("Market trade failed", error.cause);

        return c.json(
          {
            error: {
              type: "barley_trade_persistence_failed",
              message: "The market trade could not be completed"
            }
          },
          500
        );
      })
      .exhaustive();
  } catch (error) {
    console.error("Game action connection failed", error);

    return c.json(
      {
        error: {
          type: "game_action_unavailable",
          message: "The game action service is unavailable"
        }
      },
      503
    );
  } finally {
    await client.end().catch(error => {
      console.error("Failed to close database connection", error);
    });
  }
});

export default app;
