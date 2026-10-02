import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { validateBrewerySupply, brewerySupplyErrors, type BrewerySupplyRule } from "../../game-core/farm/brewerySupplies";
import { WATER_LOAD_QUANTITY, BREWERY_EMPTY_JAR_CAPACITY } from "../../game-data/brewing";
import { BEER_RECIPE } from "../../game-data/brewing";
import { brewingErrors, validateBrewing, readyBeerQuantity } from "../../game-core/farm/brewing";
import { beerTreatErrors, validateBeerTreat, happinessAfterBeer, fishTreatErrors, validateFishTreat, happinessAfterFish } from "../../game-core/farm/wellbeing";
import type { GameCommand } from "../../schemas/gameCommands";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database } from "../db/client";
import { farmBuildings, farmCrops, farmInventory, farms } from "../db/schema";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { breadTreatErrors, validateBreadTreat, happinessAfterBread } from "../../game-core/farm/wellbeing";

export class BrewerySupplyRuleError extends Data.TaggedError("BrewerySupplyRuleError")<{
  readonly type: BrewerySupplyRule | keyof typeof brewingErrors | keyof typeof fishTreatErrors | keyof typeof breadTreatErrors | "farm_not_found" | "farm_version_conflict" | "farmer_busy";
  readonly message: string;
}> {}
export class BrewerySupplyPersistenceError extends Data.TaggedError("BrewerySupplyPersistenceError")<{ readonly cause: unknown }> {}

export const supplyBrewery = (database: Database, input: Extract<GameCommand, { type: "brewery_supply" | "give_farmer_beer" | "give_farmer_fish" | "give_farmer_bread" }> & { readonly playerId: string }) =>
  Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis);
    const result = yield* Effect.tryPromise({
      try: (): Promise<FarmSnapshot | BrewerySupplyRuleError> => database.transaction(async transaction => {
        const [loaded] = await transaction.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
        if (!loaded) return new BrewerySupplyRuleError({ type: "farm_not_found", message: "The farm does not exist." });
        const farm = await advanceFarmLifecycle(transaction, loaded, now);
        if (farm.fishing || farm.carriedItemKey === "fish") return new BrewerySupplyRuleError({ type: "farmer_busy", message: "Finish fishing and store or release the fish first." });
        if (farm.version !== input.expectedFarmVersion) return new BrewerySupplyRuleError({ type: "farm_version_conflict", message: "The farm changed. Please try again." });
        const [workingCrop] = await transaction.select({ id: farmCrops.id }).from(farmCrops).where(and(
          eq(farmCrops.farmId, farm.id),
          sql`(${gt(farmCrops.plantedAt, now)} OR ${isNotNull(farmCrops.harvestStartedAt)})`
        )).limit(1);
        if (farm.production.planting || farmerProductionJob(farm) || farm.millGoods.delivery || farm.production.delivery || farm.gatheringItemKey !== null || workingCrop) return new BrewerySupplyRuleError({ type: "farmer_busy", message: "The farmer is busy." });
        const snapshot = await readFarmSnapshot(transaction, farm, false);
        // Estate gifts do not require a brewery or consume a brewery's ready batch.
        if (input.type === "give_farmer_beer" || input.type === "give_farmer_fish" || input.type === "give_farmer_bread") {
          const itemKey = input.type === "give_farmer_fish" ? "fish" : input.type === "give_farmer_bread" ? "bread" : "beer";
          const quantity = snapshot.inventory.find(item => item.itemKey === itemKey)?.quantity ?? 0;
          const validate = itemKey === "fish" ? validateFishTreat : itemKey === "bread" ? validateBreadTreat : validateBeerTreat;
          const lastTreatAt = itemKey === "fish" ? farm.lastFishAt : itemKey === "bread" ? farm.lastBreadAt : farm.lastBeerAt;
          const rule = validate(quantity, farm.happiness, lastTreatAt?.getTime() ?? null, now.getTime());
          if (rule !== null) return new BrewerySupplyRuleError({ type: rule, message: { ...fishTreatErrors, ...breadTreatErrors }[rule] });
          await transaction.update(farmInventory).set({ quantity: quantity - 1, updatedAt: now })
            .where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, itemKey)));
          const [updated] = await transaction.update(farms).set({
            happiness: itemKey === "fish" ? happinessAfterFish(farm.happiness) : itemKey === "bread" ? happinessAfterBread(farm.happiness) : happinessAfterBeer(farm.happiness),
            lastBreadAt: itemKey === "bread" ? now : farm.lastBreadAt,
            lastBeerAt: itemKey === "beer" ? now : farm.lastBeerAt,
            lastFishAt: itemKey === "fish" ? now : farm.lastFishAt,
            progressionStats: { ...farm.progressionStats, fishFed: farm.progressionStats.fishFed + (itemKey === "fish" ? 1 : 0) },
            happinessCheckedAt: now,
            version: sql`${farms.version} + 1`, updatedAt: now
          }).where(eq(farms.id, farm.id)).returning();
          return readFarmSnapshot(transaction, updated!, false);
        }
        const rule = validateBrewerySupply({ ...snapshot, ...input, carriedItem: snapshot.farm.carriedItem, now: now.getTime() });
        if (rule !== null) return new BrewerySupplyRuleError({ type: rule, message: brewerySupplyErrors[rule] });
        if (input.action === "collect_beer") return new BrewerySupplyRuleError({ type: "beer_not_ready", message: "Click the beer jars beside the brewery and choose Store to deliver them to the farm." });
        const brewingAction = input.action === "start_brewing" || input.action === "give_beer";
        let beerProduced = 0;
        if (input.action === "give_beer") {
          const brewery = snapshot.buildings.find(building => building.type === "brewery" &&
            building.column === input.target.column && building.row === input.target.row)!;
          const readyBeer = readyBeerQuantity(brewery, now.getTime());
          const beerQuantity = snapshot.inventory.find(item => item.itemKey === "beer")?.quantity ?? 0;
          const treatRule = validateBeerTreat(readyBeer + beerQuantity, farm.happiness, farm.lastBeerAt?.getTime() ?? null, now.getTime());
          if (treatRule !== null) return new BrewerySupplyRuleError({ type: treatRule, message: beerTreatErrors[treatRule] });
          if (readyBeer > 0) {
            beerProduced = 1;
            await transaction.update(farmBuildings).set({
              beerServed: readyBeer === 1 ? 0 : brewery.beerServed + 1,
              beerReadyAt: readyBeer === 1 ? null : new Date(brewery.beerReadyAt!)
            }).where(eq(farmBuildings.id, brewery.id));
          } else {
            await transaction.update(farmInventory).set({ quantity: beerQuantity - 1, updatedAt: now })
              .where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, "beer")));
          }
        }
        if (input.action === "start_brewing") {
          const brewery = snapshot.buildings.find(building => building.type === "brewery" &&
            building.column === input.target.column && building.row === input.target.row)!;
          const groats = snapshot.inventory.find(item => item.itemKey === "brewersGroats")?.quantity ?? 0;
          const brewingRule = validateBrewing(input.action, brewery, now.getTime(), groats);
          if (brewingRule !== null) return new BrewerySupplyRuleError({ type: brewingRule, message: brewingErrors[brewingRule] });
          await transaction.update(farmInventory).set({ quantity: groats - BEER_RECIPE.groats, updatedAt: now })
            .where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, "brewersGroats")));
            await transaction.update(farmBuildings).set({
              brewingWater: brewery.brewingWater - BEER_RECIPE.water,
              emptyBeerJars: brewery.emptyBeerJars - BEER_RECIPE.emptyJars,
              beerReadyAt: new Date(now.getTime() + BEER_RECIPE.durationMs),
              beerServed: 0
            }).where(eq(farmBuildings.id, brewery.id));
        }
        if (input.action === "stock_jars") {
          const brewery = snapshot.buildings.find(building => building.type === "brewery" && building.column === input.target.column && building.row === input.target.row)!;
          const quantity = Math.min(BREWERY_EMPTY_JAR_CAPACITY - brewery.emptyBeerJars,
            snapshot.inventory.find(item => item.itemKey === "emptyBeerJar")!.quantity);
          await transaction.update(farmInventory).set({ quantity: sql`${farmInventory.quantity} - ${quantity}`, updatedAt: now })
            .where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, "emptyBeerJar")));
          await transaction.update(farmBuildings).set({ emptyBeerJars: sql`${farmBuildings.emptyBeerJars} + ${quantity}` })
            .where(eq(farmBuildings.id, brewery.id));
        }
        if (input.action === "deliver") {
          const field = farm.carriedItemKey === "water" ? "brewingWater" : "brewingBarley";
          await transaction.update(farmBuildings).set({ [field]: sql`${farmBuildings[field]} + ${farm.carriedItemQuantity}` })
            .where(and(eq(farmBuildings.farmId, farm.id), eq(farmBuildings.type, "brewery"),
              eq(farmBuildings.column, input.target.column), eq(farmBuildings.row, input.target.row)));
        }
        const collecting = input.action === "collect_water";
        const [updated] = await transaction.update(farms).set({
          progressionStats: { ...farm.progressionStats, beerProduced: farm.progressionStats.beerProduced + beerProduced },
          happiness: input.action === "give_beer" ? happinessAfterBeer(farm.happiness) : farm.happiness,
          lastBeerAt: input.action === "give_beer" ? now : farm.lastBeerAt,
          happinessCheckedAt: input.action === "give_beer" ? now : farm.happinessCheckedAt,
          carriedItemKey: brewingAction ? farm.carriedItemKey : collecting ? "water" : null,
          carriedItemQuantity: brewingAction ? farm.carriedItemQuantity : collecting ? WATER_LOAD_QUANTITY : 0,
          carriedItemExpiresAt: brewingAction ? farm.carriedItemExpiresAt : null,
          version: sql`${farms.version} + 1`, updatedAt: now
        }).where(eq(farms.id, farm.id)).returning();
        return readFarmSnapshot(transaction, updated!, false);
      }),
      catch: cause => new BrewerySupplyPersistenceError({ cause })
    });
    if (result instanceof BrewerySupplyRuleError) return yield* Effect.fail(result);
    return result;
  });
