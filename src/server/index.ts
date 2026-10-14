// src/server/index.ts
import { claimBuildingReadiness } from "./services/buildingReadiness";
import { tendPerennialCrop, PerennialCropRuleError, PerennialCropPersistenceError } from "./services/perennialCrops";

import { Effect, Either } from "effect";
import { LeaderboardQuerySchema } from "../schemas/leaderboard";
import { readLeaderboard } from "./services/leaderboard";
import { MarketPresenceCommandSchema } from "../schemas/marketPresence";
import { updateMarketPresence } from "./services/marketPresence";
import { NameFarmerCommandSchema } from "../schemas/farmerProfile";
import { nameFarmer } from "./services/farmerProfile";
import { ResidenceCommandSchema } from "../schemas/residence";
import { chooseResidence, readResidence } from "./services/residence";
import { eq, inArray } from "drizzle-orm";
import { commandUnlockLevel } from "../game-core/farm/commandUnlock";
import { startMilling, deliverMillGoods, MillingRuleError, MillingPersistenceError } from "./services/milling";
import { productionAction, ProductionRuleError, ProductionPersistenceError } from "./services/production";
import { hirePorter, PorterRuleError, PorterPersistenceError } from "./services/porter";
import { upgradeBuilding, BuildingUpgradeRuleError, BuildingUpgradePersistenceError } from "./services/buildingUpgrades";
import { destroyBuilding, BuildingDemolitionRuleError, BuildingDemolitionPersistenceError } from "./services/destroyBuilding";
import { batchPlantingAction, BatchPlantingError, BatchPlantingPersistenceError } from "./services/batchPlanting";
import { buildRoad, RoadRuleError, RoadPersistenceError } from "./services/buildRoad";
import { isProgressionSignpost } from "../game-data/progression";
import { claimFarmLevel, LevelClaimRuleError, LevelClaimPersistenceError } from "./services/claimFarmLevel";
import { Hono } from "hono";
import { Client } from "pg";
import { match, P } from "ts-pattern";

import { GameCommandSchema } from "../schemas/gameCommands";
import { FarmerUnavailableError } from "./services/farmerAvailability";
import { fishingAction, FishingRuleError, FishingPersistenceError } from "./services/fishing";
import { getNpcRequests, deliverNpcRequest, NpcRequestRuleError, NpcRequestPersistenceError } from "./services/npcRequests";
import type { FarmSnapshot } from "../schemas/farm";
import { getMarketQuotes } from "./services/marketQuotes";
import { getMarketListings } from "./services/marketListings";
import { MarketListingsQuerySchema } from "../schemas/marketListings";
import { getTradeHistory } from "./services/tradeHistory";
import { TradeHistoryQuerySchema } from "../schemas/tradeHistory";
import { describeBuildingPlacementRule } from "../game-core/farm/buildings";
import { createDatabase } from "./db/client";
import { players, farms, marketOrders } from "./db/schema";
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
  buildFarmBuilding,
  BuildFarmBuildingPersistenceError,
  BuildFarmBuildingRuleError,
  type BuildFarmBuildingError
} from "./services/buildFarmBuilding";
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
  destroyGroundMaterial,
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
import {
  cancelMarketSellOrder,
  createMarketSellOrder,
  MarketSellOrderPersistenceError,
  MarketSellOrderRuleError,
  type MarketSellOrderError
} from "./services/marketSellOrders";

import { DEVELOPMENT_PLAYERS, resolveDevelopmentPlayer } from "../game-data/developmentPlayers";
import { supplyBrewery, BrewerySupplyRuleError, BrewerySupplyPersistenceError } from "./services/brewerySupplies";
import { buyMarketSellOrder, PlayerMarketRuleError, PlayerMarketPersistenceError } from "./services/buyMarketSellOrder";

const app = new Hono<{ Bindings: Env; Variables: { developmentPlayer: NonNullable<ReturnType<typeof resolveDevelopmentPlayer>> } }>();

app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/health" || c.req.path === "/api/db/health") return next();
  if (!import.meta.env.DEV) return c.notFound();
  const player = resolveDevelopmentPlayer(c.req.header("x-development-player"));
  if (player === undefined) return c.json({ error: { type: "invalid_development_player", message: "Unknown test player" } }, 400);
  c.set("developmentPlayer", player);
  return next();
});

type GameActionEffect = Effect.Effect<
  FarmSnapshot,
  | BuildIrrigationError
  | MillingRuleError
  | PorterRuleError
  | BuildingUpgradeRuleError
  | BuildingDemolitionRuleError
  | BuildingDemolitionPersistenceError
  | BuildingUpgradePersistenceError
  | PorterPersistenceError
  | ProductionRuleError
  | BatchPlantingError
  | BatchPlantingPersistenceError
  | RoadRuleError
  | RoadPersistenceError
  | ProductionPersistenceError
  | MillingPersistenceError
  | LevelClaimRuleError
  | LevelClaimPersistenceError
  | FishingRuleError
  | FarmerUnavailableError
  | FishingPersistenceError
  | NpcRequestRuleError
  | NpcRequestPersistenceError
  | BrewerySupplyRuleError
  | BrewerySupplyPersistenceError
  | BuildFarmBuildingError
  | DestroyIrrigationError
  | FarmItemActionError
  | GatherResourceError
  | HarvestCropError
  | PlantCropError
  | MarketTradeError
  | MarketSellOrderError
  | PlayerMarketRuleError
  | PlayerMarketPersistenceError
  | PerennialCropRuleError
  | PerennialCropPersistenceError
>;

app.get("/api/health", c => {
  return c.json({ ok: true });
});

app.post("/api/notifications/building-ready", async c => {
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    return c.json(await claimBuildingReadiness(createDatabase(client), c.get("developmentPlayer").id));
  } catch (error) {
    console.error("Building readiness notification unavailable", error);
    return c.json({ error: { message: "Could not check building readiness." } }, 503);
  } finally { await client.end().catch(error => console.error("Closing notification connection failed", error)); }
});

app.on(["GET", "POST"], "/api/residence", async c => {
  if (!import.meta.env.DEV) return c.notFound();
  const parsed = c.req.method === "POST"
    ? ResidenceCommandSchema.safeParse(await c.req.json().catch(() => null)) : null;
  if (parsed && !parsed.success) return c.json({ error: { message: "Choose a valid city and neighbourhood option." } }, 400);
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    const db = createDatabase(client);
    const playerId = c.get("developmentPlayer").id;
    if (!parsed) return c.json({ residence: await readResidence(db, playerId) });
    if (!parsed.success) return c.json({ error: { message: "Invalid choice." } }, 400);
    const result = await Effect.runPromise(Effect.either(chooseResidence(db, playerId, parsed.data)));
    if (Either.isLeft(result)) {
      console.error("Residence persistence failed", result.left.cause);
      return c.json({ error: { message: "Your city could not be saved. Please retry." } }, 500);
    }
    return result.right.type === "rejected"
      ? c.json({ error: { message: result.right.message } }, 409)
      : c.json({ residence: result.right.residence });
  } catch (error) {
    console.error("Residence unavailable", error);
    return c.json({ error: { message: "City selection is unavailable. Please retry." } }, 503);
  } finally { await client.end().catch(error => console.error("Closing residence connection failed", error)); }
});

app.post("/api/farmer/profile", async c => {
  const command = NameFarmerCommandSchema.safeParse(await c.req.json().catch(() => null));
  if (!command.success) return c.json({ error: { message: "Choose one of the available farmer names." } }, 400);
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    const result = await Effect.runPromise(Effect.either(nameFarmer(createDatabase(client), c.get("developmentPlayer").id, command.data.name)));
    if (Either.isLeft(result)) {
      console.error("Farmer profile failed", result.left.cause);
      return c.json({ error: { message: "Your farmer's name could not be saved. Please retry." } }, 500);
    }
    return result.right.type === "ok" ? c.json({ profile: result.right.profile }) : c.json({ error: { message: result.right.message } }, 409);
  } catch (error) {
    console.error("Farmer profile connection failed", error);
    return c.json({ error: { message: "Farmer customization is unavailable. Please retry." } }, 503);
  } finally { await client.end().catch(error => console.error("Closing profile connection failed", error)); }
});

app.post("/api/market/presence", async c => {
  const command = MarketPresenceCommandSchema.safeParse(await c.req.json().catch(() => null));
  if (!command.success) return c.json({ error: { message: "Invalid market visit." } }, 400);
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    const result = await Effect.runPromise(Effect.either(updateMarketPresence(createDatabase(client), c.get("developmentPlayer").id, command.data)));
    if (Either.isLeft(result)) {
      console.error("Market presence failed", result.left.cause);
      return c.json({ error: { message: "Live neighbours are temporarily unavailable." } }, 503);
    }
    return result.right.type === "ok" ? c.json({ visitors: result.right.visitors })
      : c.json({ error: { message: result.right.message } }, 409);
  } catch (error) {
    console.error("Market presence connection failed", error);
    return c.json({ error: { message: "Live neighbours are temporarily unavailable." } }, 503);
  } finally { await client.end().catch(error => console.error("Closing presence connection failed", error)); }
});

app.get("/api/leaderboard", async c => {
  const query = LeaderboardQuerySchema.safeParse(c.req.query());
  if (!query.success) return c.json({ error: { message: "Choose a valid leaderboard and metric." } }, 400);
  c.header("Cache-Control", "no-store");
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    const result = await Effect.runPromise(Effect.either(readLeaderboard(createDatabase(client), c.get("developmentPlayer").id, query.data)));
    if (Either.isLeft(result)) {
      console.error("Leaderboard failed", result.left.cause);
      return c.json({ error: { message: "Leaderboard temporarily unavailable." } }, 503);
    }
    return result.right.type === "ok" ? c.json(result.right.leaderboard)
      : c.json({ error: { message: result.right.message } }, 409);
  } catch (error) {
    console.error("Leaderboard connection failed", error);
    return c.json({ error: { message: "Leaderboard temporarily unavailable." } }, 503);
  } finally { await client.end().catch(error => console.error("Closing leaderboard connection failed", error)); }
});

app.get("/api/market/quotes", async c => {
  const client = new Client({
    connectionString: c.env.HYPERDRIVE.connectionString
  });

  try {
    await client.connect();
    const result = await Effect.runPromise(
      Effect.either(
        getMarketQuotes(createDatabase(client), c.get("developmentPlayer").id)
      )
    );

    if (Either.isLeft(result)) {
      console.error("Market quotes failed", result.left.cause);

      return c.json(
        {
          error: {
            type: "market_quotes_unavailable",
            message: "The current market prices could not be loaded"
          }
        },
        500
      );
    }

    return c.json(result.right);
  } catch (error) {
    console.error("Market quote connection failed", error);

    return c.json(
      {
        error: {
          type: "market_quotes_unavailable",
          message: "The current market prices could not be loaded"
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

app.get("/api/market/requests", async c => {
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    const result = await Effect.runPromise(Effect.either(getNpcRequests(createDatabase(client), c.get("developmentPlayer").id)));
    if (Either.isLeft(result)) {
      if (result.left instanceof NpcRequestRuleError && result.left.reason === "locked") {
        return c.json({ error: { type: "level_locked", message: "Merchant requests unlock at farm level 7." } }, 422);
      }
      console.error("NPC requests failed", result.left);
      return c.json({ error: { message: "Requests could not be loaded" } }, 500);
    }
    return c.json(result.right);
  } catch (error) {
    console.error("NPC request connection failed", error);
    return c.json({ error: { message: "Requests are unavailable" } }, 503);
  } finally {
    await client.end().catch(error => console.error("Failed to close database connection", error));
  }
});

app.get("/api/market/listings", async c => {
  let after: unknown;
  try {
    const raw = c.req.query("after");
    after = raw === undefined ? undefined : JSON.parse(raw);
  } catch {
    return c.json({ error: { type: "invalid_listings_query", message: "Invalid listing cursor" } }, 400);
  }
  const query = MarketListingsQuerySchema.safeParse({ ...c.req.query(), after });
  if (!query.success) {
    return c.json({ error: { type: "invalid_listings_query", message: "Invalid listings request" } }, 400);
  }
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    const result = await Effect.runPromise(Effect.either(
      getMarketListings(createDatabase(client), c.get("developmentPlayer").id, query.data)
    ));
    if (Either.isLeft(result)) {
      console.error("Market listings failed", result.left.cause);
      return c.json({ error: { type: "market_listings_unavailable", message: "Listings could not be loaded" } }, 500);
    }
    return c.json(result.right);
  } catch (error) {
    console.error("Market listings connection failed", error);
    return c.json({ error: { type: "market_listings_unavailable", message: "Listings are unavailable" } }, 503);
  } finally {
    await client.end().catch(error => console.error("Failed to close database connection", error));
  }
});

app.get("/api/market/history", async c => {
  const query = TradeHistoryQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: { type: "invalid_history_query", message: "Invalid history page request" } }, 400);
  }
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    const result = await Effect.runPromise(Effect.either(
      getTradeHistory(createDatabase(client), c.get("developmentPlayer").id, query.data)
    ));
    if (Either.isLeft(result)) {
      console.error("Trade history failed", result.left.cause);
      return c.json({ error: { type: "trade_history_unavailable", message: "Trade history could not be loaded" } }, 500);
    }
    return c.json(result.right);
  } catch (error) {
    console.error("Trade history connection failed", error);
    return c.json({ error: { type: "trade_history_unavailable", message: "Trade history is unavailable" } }, 503);
  } finally {
    await client.end().catch(error => console.error("Failed to close database connection", error));
  }
});

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

// Read names without bootstrapping or advancing any other player's farm.
app.get("/api/development/players", async c => {
  if (!import.meta.env.DEV) return c.notFound();
  c.header("Cache-Control", "no-store");
  const client = new Client({ connectionString: c.env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    const rows = await createDatabase(client).select({ playerId: farms.playerId, profile: farms.farmerProfile })
      .from(farms).where(inArray(farms.playerId, DEVELOPMENT_PLAYERS.map(player => player.id)));
    return c.json({ players: DEVELOPMENT_PLAYERS.flatMap(player => {
      const name = rows.find(row => row.playerId === player.id)?.profile?.identity.name;
      return name ? [{ key: player.key, name }] : [];
    }) });
  } catch (error) {
    console.error("Development player names could not be loaded", error);
    return c.json({ error: { message: "Test player names could not be loaded." } }, 503);
  } finally { await client.end().catch(() => {}); }
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
      Effect.either(ensureDevelopmentFarm(database, randomSeed, c.get("developmentPlayer")))
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
    const command = parsedCommand.data;
    if (!await readResidence(database, c.get("developmentPlayer").id)) return c.json({ error: { type: "city_required", message: "Choose your city before starting your farm." } }, 409);
    const [progressFarm] = await database.select({ level: farms.level, production: farms.production, farmerProfile: farms.farmerProfile }).from(farms).where(eq(farms.playerId, c.get("developmentPlayer").id));
    if (progressFarm && !progressFarm.farmerProfile) return c.json({ error: { type: "farmer_name_required", message: "Choose your farmer's name before starting your farm." } }, 409);
    if (progressFarm?.production.planting && command.type !== "advance_batch_planting") return c.json({ error: { type: "farmer_busy", message: "Finish or stop planting or harvesting the selected fields first." } }, 409);
    const order = command.type === "buy_market_sell_order"
      ? (await database.select({ itemKey: marketOrders.itemKey }).from(marketOrders).where(eq(marketOrders.id, command.orderId)))[0]
      : undefined;
    const requiredLevel = commandUnlockLevel(command, order?.itemKey);
    // Levels only increase. The service still validates resources/version under its farm lock.
    if (progressFarm && progressFarm.level < requiredLevel) return c.json({ error: { type: "level_locked", message: `Reach farm level ${requiredLevel} to unlock this action.` } }, 422);
    if ("target" in command && isProgressionSignpost(command.target)) return c.json({ error: { type: "tile_occupied", message: "This tile is reserved for the farm's level signpost." } }, 422);
    const result = await Effect.runPromise(
      Effect.either(
        match(command)
          .returnType<GameActionEffect>()
          .with({ type: P.union("start_batch_planting", "start_batch_harvesting", "advance_batch_planting") }, command => batchPlantingAction(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "build_road" }, command => buildRoad(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "start_milling" }, command => startMilling(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "mill_delivery" }, command => deliverMillGoods(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "claim_farm_level" }, command => claimFarmLevel(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: P.union("fishing", "cast_fishing", "cancel_fishing") }, command => fishingAction(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "brewery_supply" }, command => supplyBrewery(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "give_farmer_beer" }, command => supplyBrewery(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "give_farmer_fish" }, command => supplyBrewery(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "give_farmer_dates" }, command => supplyBrewery(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "tend_perennial_crop" }, command => tendPerennialCrop(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "give_farmer_bread" }, command => supplyBrewery(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "build_irrigation" }, command =>
            buildIrrigation(database, {
              playerId: c.get("developmentPlayer").id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "hire_porter" }, command => hirePorter(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "upgrade_building" }, command => upgradeBuilding(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: "destroy_building" }, command => destroyBuilding(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: P.union("start_baking", "production_delivery", "shrine_offering") }, command => productionAction(database, { ...command, playerId: c.get("developmentPlayer").id }))
          .with({ type: P.union("build_granary", "build_brewery", "build_mill", "build_bread_oven", "build_small_shrine", "build_warehouse") }, command =>
            buildFarmBuilding(database, {
              building: command.type === "build_warehouse" ? "warehouse" : command.type === "build_small_shrine" ? "smallShrine" : command.type === "build_bread_oven" ? "breadOven" : command.type === "build_mill" ? "mill" : command.type === "build_brewery" ? "brewery" : "granary",
              playerId: c.get("developmentPlayer").id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "destroy_irrigation" }, command =>
            destroyIrrigation(database, {
              playerId: c.get("developmentPlayer").id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "plant_crop" }, command =>
            plantCrop(database, {
              playerId: c.get("developmentPlayer").id,
              crop: command.crop,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "start_harvest_crop" }, command =>
            startHarvestCrop(database, {
              playerId: c.get("developmentPlayer").id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "complete_harvest_crop" }, command =>
            completeHarvestCrop(database, {
              playerId: c.get("developmentPlayer").id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "start_gather_resource" }, command =>
            startGatherResource(database, {
              playerId: c.get("developmentPlayer").id,
              itemKey: command.itemKey,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "complete_gather_resource" }, command =>
            completeGatherResource(database, {
              playerId: c.get("developmentPlayer").id,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "destroy_ground_material" }, command =>
            destroyGroundMaterial(database, { ...command, playerId: c.get("developmentPlayer").id })
          )
          .with({ type: "pickup_ground_item" }, command =>
            pickupGroundItem(database, {
              playerId: c.get("developmentPlayer").id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "drop_carried_item" }, command =>
            dropCarriedItem(database, {
              playerId: c.get("developmentPlayer").id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "deposit_carried_item" }, command =>
            depositCarriedItem(database, {
              playerId: c.get("developmentPlayer").id,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "deposit_carried_item_in_granary" }, command =>
            depositCarriedItemInGranary(database, {
              playerId: c.get("developmentPlayer").id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "withdraw_inventory_item" }, command =>
            withdrawInventoryItem(database, {
              playerId: c.get("developmentPlayer").id,
              itemKey: command.itemKey,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "withdraw_barley_from_granary" }, command =>
            withdrawBarleyFromGranary(database, {
              playerId: c.get("developmentPlayer").id,
              target: command.target,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "deliver_npc_request" }, command =>
            deliverNpcRequest(database, { ...command, playerId: c.get("developmentPlayer").id })
          )
          .with({ type: "buy_from_npc_market" }, command =>
            buyFromNpcMarket(database, {
              playerId: c.get("developmentPlayer").id,
              itemKey: command.itemKey,
              quantity: command.quantity,
              expectedUnitPrice: command.expectedUnitPrice,
              idempotencyKey: command.idempotencyKey,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "sell_to_npc_market" }, command =>
            sellToNpcMarket(database, {
              playerId: c.get("developmentPlayer").id,
              itemKey: command.itemKey,
              quantity: command.quantity,
              expectedUnitPrice: command.expectedUnitPrice,
              idempotencyKey: command.idempotencyKey,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "buy_market_sell_order" }, command =>
            buyMarketSellOrder(database, { ...command, playerId: c.get("developmentPlayer").id })
          )
          .with({ type: "create_market_sell_order" }, command =>
            createMarketSellOrder(database, {
              playerId: c.get("developmentPlayer").id,
              itemKey: command.itemKey,
              quantity: command.quantity,
              unitPrice: command.unitPrice,
              idempotencyKey: command.idempotencyKey,
              expectedFarmVersion: command.expectedFarmVersion
            })
          )
          .with({ type: "cancel_market_sell_order" }, command =>
            cancelMarketSellOrder(database, {
              playerId: c.get("developmentPlayer").id,
              orderId: command.orderId,
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
      .with(P.instanceOf(MillingRuleError), error => c.json({ error: { type: "milling_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(BuildingUpgradeRuleError), error => c.json({ error: { type: "building_upgrade_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(BuildingDemolitionRuleError), error => c.json({ error: { type: "building_demolition_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(BuildingDemolitionPersistenceError), error => {
        console.error("Building demolition failed", error.cause);
        return c.json({ error: { type: "building_demolition_failed", message: "Could not destroy the building. Please try again." } }, 500);
      })
      .with(P.instanceOf(BuildingUpgradePersistenceError), error => {
        console.error("Building upgrade failed", error.cause);
        return c.json({ error: { type: "building_upgrade_failed", message: "Could not upgrade the building. Please try again." } }, 500);
      })
      .with(P.instanceOf(PorterPersistenceError), error => {
        console.error("Porter operation failed", error.cause);
        return c.json({ error: { type: "porter_failed", message: "Could not hire the porter. Please try again." } }, 500);
      })
      .with(P.instanceOf(PorterRuleError), error => c.json({ error: { type: "porter_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(PerennialCropRuleError), error => c.json({ error: { type: "crop_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(PerennialCropPersistenceError), error => {
        console.error("Crop work failed", error.cause);
        return c.json({ error: { type: "crop_failed", message: "Could not update the crop." } }, 500);
      })
      .with(P.instanceOf(ProductionRuleError), error => c.json({ error: { type: "production_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(BatchPlantingError), error => c.json({ error: { type: "batch_planting_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(BatchPlantingPersistenceError), () => c.json({ error: { type: "batch_planting_failed", message: "Planting could not be updated." } }, 500))
      .with(P.instanceOf(RoadRuleError), error => c.json({ error: { type: "road_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(RoadPersistenceError), () => c.json({ error: { type: "road_failed", message: "The road could not be saved." } }, 500))
      .with(P.instanceOf(ProductionPersistenceError), () => c.json({ error: { type: "production_failed", message: "Production could not be updated." } }, 500))
      .with(P.instanceOf(MillingPersistenceError), error => {
        console.error("Milling failed", error.cause);
        return c.json({ error: { type: "milling_failed", message: "Milling could not start." } }, 500);
      })
      .with(P.instanceOf(BrewerySupplyRuleError), error => c.json({ error: { type: error.type, message: error.message } }, 409))
      .with(P.instanceOf(FarmerUnavailableError), error => c.json({ error: { type: "farmer_busy", message: error.message } }, 409))
      .with(P.instanceOf(LevelClaimRuleError), error => c.json({ error: { type: "level_claim_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(LevelClaimPersistenceError), error => {
        console.error("Level claim failed", error);
        return c.json({ error: { type: "level_claim_failed", message: "The next level could not be claimed." } }, 500);
      })
      .with(P.instanceOf(FishingRuleError), error => c.json({ error: { type: "fishing_unavailable", message: error.message } }, 409))
      .with(P.instanceOf(FishingPersistenceError), error => {
        console.error("Fishing failed", error.cause);
        return c.json({ error: { type: "fishing_failed", message: "Fishing could not be completed." } }, 500);
      })
      .with(P.instanceOf(NpcRequestRuleError), error => c.json({ error: {
        type: error.reason === "version_conflict" ? "farm_version_conflict" : "npc_request_unavailable",
        message: match(error.reason)
          .with("missing_farm", () => "Your farm could not be found.")
          .with("locked", () => "Merchant requests unlock at farm level 7.")
          .with("expired", () => "This request has expired. Refresh the requests.")
          .with("insufficient_goods", () => "Store all the requested goods before delivering.")
          .with("version_conflict", () => "Your farm changed. Please try again.")
          .with("idempotency_conflict", () => "This transaction key was already used.")
          .with("balance_limit", () => "Your shekel balance is at its limit.")
          .exhaustive()
      } }, 409))
      .with(P.instanceOf(NpcRequestPersistenceError), error => {
        console.error("NPC delivery failed", error.cause);
        return c.json({ error: { type: "npc_request_failed", message: "The delivery could not be completed." } }, 500);
      })
      .with(P.instanceOf(BrewerySupplyPersistenceError), () => c.json({ error: { type: "brewery_supply_failed", message: "The brewery supply action could not be completed." } }, 500))
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
      .with(P.instanceOf(BuildFarmBuildingRuleError), error =>
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
            { type: "outside_building_ground" },
            { type: "footprint_occupied" },
            { type: "building_limit" },
            { type: "access_blocked" },
            { type: "road_access_required" },
            { type: "hands_not_empty" },
            { type: "missing_material" },
            rule =>
              c.json(
                {
                  error: {
                    type: `invalid_building_${rule.type}`,
                    message: describeBuildingPlacementRule(rule)
                  }
                },
                422
              )
          )
          .exhaustive()
      )
      .with(P.instanceOf(BuildFarmBuildingPersistenceError), error => {
        console.error("Building construction failed", error.cause);

        return c.json(
          {
            error: {
              type: "building_persistence_failed",
              message: "The building construction could not be saved"
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
                  message: "Barley can only be dropped on arable land"
                }
              },
              422
            )
          )
          .with({ type: "invalid_drop_ground" }, () =>
            c.json({ error: { type: "invalid_drop_ground", message: "Choose an empty ground tile" } }, 422)
          )
          .with({ type: "ground_tile_occupied" }, () =>
            c.json(
              {
                error: {
                  type: "ground_tile_occupied",
                  message: "This ground tile is occupied"
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
          .with({ type: "storage_full" }, () => c.json({ error: { type: "storage_full", message: "Material storage is full. Use some materials before gathering more." } }, 409))
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
          .with({ type: "barley_reserve_required" }, () =>
            c.json({ error: { type: "barley_reserve_required", message: "You must keep 1 barley in your farm" } }, 409)
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
      .with(P.instanceOf(PlayerMarketRuleError), error =>
        c.json({ error: { type: error.type, message: error.message } }, 409)
      )
      .with(P.instanceOf(PlayerMarketPersistenceError), error => {
        console.error("Player purchase failed", error.cause);
        return c.json({ error: { type: "player_purchase_failed", message: "The purchase could not be completed" } }, 500);
      })
      .with(P.instanceOf(MarketSellOrderRuleError), error =>
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
                  message: "The farm changed before this order was applied",
                  actualVersion: rule.actualVersion
                }
              },
              409
            )
          )
          .with({ type: "sell_order_unavailable" }, rule =>
            c.json(
              {
                error: {
                  type: "market_sell_order_unavailable",
                  message: `${rule.itemKey} cannot currently be listed for sale`
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
                  message: `Only ${rule.available} stored ${rule.itemKey} is available to list`
                }
              },
              409
            )
          )
          .with({ type: "barley_reserve_required" }, () =>
            c.json({ error: { type: "barley_reserve_required", message: "You must keep 1 barley in your farm" } }, 409)
          )
          .with({ type: "order_not_found" }, () =>
            c.json(
              {
                error: {
                  type: "market_order_not_found",
                  message: "The market order does not exist"
                }
              },
              404
            )
          )
          .with({ type: "order_already_filled" }, () =>
            c.json(
              {
                error: {
                  type: "market_order_already_filled",
                  message: "A filled market order cannot be cancelled"
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
                  message: `Free ${rule.available} ${rule.itemKey} storage spaces before cancelling this order`
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
                  message: "This order identifier was already used"
                }
              },
              409
            )
          )
          .exhaustive()
      )
      .with(P.instanceOf(MarketSellOrderPersistenceError), error => {
        console.error("Market sell order failed", error.cause);

        return c.json(
          {
            error: {
              type: "market_sell_order_persistence_failed",
              message: "The market sell order could not be saved"
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
