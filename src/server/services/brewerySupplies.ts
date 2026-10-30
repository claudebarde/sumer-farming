import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { setStoredQuantity } from "./physicalStorage";
import { productionOutputFits, OUTPUT_FULL_MESSAGE } from "../../game-core/farm/productionOutputCapacity";
import { planProductionJourney, productionArrivalAt } from "../../game-core/farm/productionJourney";
import { BREWING_PREPARATION_MS } from "../../game-data/brewing";
import { datesTreatErrors, validateDatesTreat, happinessAfterDates } from "../../game-core/farm/wellbeing";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { validateBrewerySupply, brewerySupplyErrors, type BrewerySupplyRule } from "../../game-core/farm/brewerySupplies";
import { WATER_LOAD_QUANTITY, BREWERY_EMPTY_JAR_CAPACITY } from "../../game-data/brewing";
import { BEER_RECIPE } from "../../game-data/brewing";
import { activeBuildingUpgrade, buildingLevel, buildingProductionMultiplier } from "../../game-data/buildingUpgrades";
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
  readonly type: BrewerySupplyRule | keyof typeof brewingErrors | keyof typeof fishTreatErrors | keyof typeof breadTreatErrors | keyof typeof datesTreatErrors | "farm_not_found" | "farm_version_conflict" | "farmer_busy" | "level_locked";
  readonly message: string;
}> {}
export class BrewerySupplyPersistenceError extends Data.TaggedError("BrewerySupplyPersistenceError")<{ readonly cause: unknown }> {}

export const supplyBrewery = (database: Database, input: Extract<GameCommand, { type: "brewery_supply" | "give_farmer_beer" | "give_farmer_fish" | "give_farmer_bread" | "give_farmer_dates" }> & { readonly playerId: string }) =>
  Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis);
    const result = yield* Effect.tryPromise({
      try: (): Promise<FarmSnapshot | BrewerySupplyRuleError> => database.transaction(async transaction => {
        const [loaded] = await transaction.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
        if (!loaded) return new BrewerySupplyRuleError({ type: "farm_not_found", message: "The farm does not exist." });
        const farm = await advanceFarmLifecycle(transaction, loaded, now);
        if (farm.fishing || farm.carriedItemKey === "fish") return new BrewerySupplyRuleError({ type: "farmer_busy", message: "Finish fishing and store or release the fish first." });
        // Water occupies the farmer's hands, not estate storage. Porter/lifecycle
        // updates may change the version during the walk to the river. Revalidate
        // this action against the latest state under the farm lock instead; retain
        // version protection for all inventory-consuming/transferring commands.
        const collectingWater = input.type === "brewery_supply" && input.action === "collect_water";
        if (!collectingWater && farm.version !== input.expectedFarmVersion) return new BrewerySupplyRuleError({ type: "farm_version_conflict", message: "The farm changed. Please try again." });
        const [workingCrop] = await transaction.select({ id: farmCrops.id }).from(farmCrops).where(and(
          eq(farmCrops.farmId, farm.id),
          sql`(${gt(farmCrops.plantedAt, now)} OR ${isNotNull(farmCrops.harvestStartedAt)})`
        )).limit(1);
        if (farm.production.materialDelivery || farm.production.planting || farmerProductionJob(farm) || farm.millGoods.delivery || farm.production.delivery || farm.gatheringItemKey !== null || workingCrop) return new BrewerySupplyRuleError({ type: "farmer_busy", message: "The farmer is busy." });
        const snapshot = await readFarmSnapshot(transaction, farm, false);
        if (farm.production.cropWork && !farm.production.cropWork.settled) return new BrewerySupplyRuleError({ type: "farmer_busy", message: "The farmer is busy." });
        if (input.type === "give_farmer_dates") {
          if (farm.level < 9) return new BrewerySupplyRuleError({ type: "level_locked", message: "Dates unlock at level 9." });
          const quantity = snapshot.inventory.find(i => i.itemKey === "dates")?.quantity ?? 0;
          const rule = validateDatesTreat(quantity, farm.happiness, farm.production.lastDatesAt ? Date.parse(farm.production.lastDatesAt) : null, now.getTime());
          if (rule) return new BrewerySupplyRuleError({ type: rule, message: datesTreatErrors[rule] });
          await setStoredQuantity(transaction, farm.id, "dates", quantity - 1, now);
          const [updated] = await transaction.update(farms).set({ happiness: happinessAfterDates(farm.happiness), happinessCheckedAt: now,
            production: { ...farm.production, lastDatesAt: now.toISOString() }, version: sql`${farms.version} + 1`, updatedAt: now }).where(eq(farms.id, farm.id)).returning();
          return readFarmSnapshot(transaction, updated!, false);
        }
        // Estate gifts do not require a brewery or consume a brewery's ready batch.
        if (input.type === "give_farmer_beer" || input.type === "give_farmer_fish" || input.type === "give_farmer_bread") {
          const itemKey = input.type === "give_farmer_fish" ? "fish" : input.type === "give_farmer_bread" ? "bread" : "beer";
          const quantity = snapshot.inventory.find(item => item.itemKey === itemKey)?.quantity ?? 0;
          const validate = itemKey === "fish" ? validateFishTreat : itemKey === "bread" ? validateBreadTreat : validateBeerTreat;
          const lastTreatAt = itemKey === "fish" ? farm.lastFishAt : itemKey === "bread" ? farm.lastBreadAt : farm.lastBeerAt;
          const rule = validate(quantity, farm.happiness, lastTreatAt?.getTime() ?? null, now.getTime());
          if (rule !== null) return new BrewerySupplyRuleError({ type: rule, message: { ...fishTreatErrors, ...breadTreatErrors }[rule] });
          await setStoredQuantity(transaction, farm.id, itemKey, quantity - 1, now);
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
        let production = farm.production;
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
            await setStoredQuantity(transaction, farm.id, "beer", beerQuantity - 1, now);
          }
        }
        if (input.action === "start_brewing") {
          if (farm.level < 6 || farm.carriedItemKey || snapshot.buildings.some(b => Date.parse(b.completesAt) > now.getTime()) ||
            snapshot.improvements.some(i => Date.parse(i.completesAt) > now.getTime() || i.destroyStartedAt !== null) || farm.roads.some(r => (r.completesAt ?? 0) > now.getTime()))
            return new BrewerySupplyRuleError({ type: "farmer_busy", message: "Unlock level 6, finish the current task and empty the farmer's hands first." });
          const brewery = snapshot.buildings.find(building => building.type === "brewery" &&
            building.column === input.target.column && building.row === input.target.row)!;
          const groats = snapshot.inventory.find(item => item.itemKey === "brewersGroats")?.quantity ?? 0;
          if (activeBuildingUpgrade(farm.production.buildingUpgrades, brewery.id, now.getTime())) return new BrewerySupplyRuleError({ type: "brewery_unavailable", message: "The Brewery is upgrading." });
          const brewingRule = validateBrewing(input.action, brewery, now.getTime(), groats);
          if (brewingRule !== null) return new BrewerySupplyRuleError({ type: brewingRule, message: brewingErrors[brewingRule] });
          if (!productionOutputFits(snapshot.farm, brewery.id, BEER_RECIPE.output)) return new BrewerySupplyRuleError({ type: "batch_active", message: OUTPUT_FULL_MESSAGE });
          const preparation = planProductionJourney(snapshot, brewery.id, now.getTime(), input, "brewing");
          if (!preparation) return new BrewerySupplyRuleError({ type: "brewery_unavailable", message: "The brewery needs an accessible loading tile." });
          const arrivedAt = productionArrivalAt(preparation);
          const startedAt = arrivedAt + BREWING_PREPARATION_MS;
          const completesAt = startedAt + Math.round(BEER_RECIPE.durationMs * buildingProductionMultiplier("brewery", buildingLevel(farm.production.buildingUpgrades, brewery.id, now.getTime())));
          production = { ...production, brewing: { ...production.brewing, [brewery.id]: { preparation, arrivedAt: new Date(arrivedAt).toISOString(), startedAt: new Date(startedAt).toISOString(), completesAt: new Date(completesAt).toISOString() } } };
          await setStoredQuantity(transaction, farm.id, "brewersGroats", groats - BEER_RECIPE.groats, now);
            await transaction.update(farmBuildings).set({
              brewingWater: brewery.brewingWater - BEER_RECIPE.water,
              emptyBeerJars: brewery.emptyBeerJars - BEER_RECIPE.emptyJars,
              beerReadyAt: new Date(completesAt),
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
          production,
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
