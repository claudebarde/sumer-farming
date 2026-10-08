import { match } from "ts-pattern";
import { getRiverConnectedCanals } from "./irrigation";
import { LEVEL_9_REQUIRED_BARLEY, LEVEL_9_REQUIRED_PRODUCTION, LEVEL_9_FOOD_OFFERING } from "../../game-data/progression";
import { LEVEL_7_REQUIRED_PRODUCTION, LEVEL_7_REQUIRED_SALES, LEVEL_7_FOOD_OFFERING, LEVEL_8_REQUIRED_GRANARY_BARLEY, type ProgressionStats } from "../../game-data/progression";
import { LEVEL_6_PROCESSED_BARLEY, LEVEL_6_PROCESSED_GOODS_OFFERING } from "../../game-data/milling";
import type { FarmSnapshot } from "../../schemas/farm";
import { INITIAL_PROGRESSION_STATS, LEVEL_4_REQUIRED_HARVESTS, LEVEL_6_REQUIRED_HARVESTS, LEVEL_4_BARLEY_OFFERING, LEVEL_5_BARLEY_OFFERING, MAX_PLAYABLE_LEVEL } from "../../game-data/progression";

export type LevelOffering = { readonly source: "ground_barley" | "granary_barley" | "fish" | "processed_grain" | "prepared_food" | "bread" | "beer"; readonly quantity: number };
export const evaluateProgression = (snapshot: FarmSnapshot, now: number) => {
  const progress = snapshot.farm.progression;
  const level = progress?.level ?? 1;
  const stats: ProgressionStats = progress?.stats ?? INITIAL_PROGRESSION_STATS;
  const produced = stats.beerProduced + (stats.breadProduced ?? 0);
  const level8Barley = Math.max(0, stats.harvestedBarley - (stats.level8Baseline?.harvestedBarley ?? stats.harvestedBarley));
  const level8Produced = Math.max(0, produced - (stats.level8Baseline?.produced ?? produced));
  const breadStock = snapshot.inventory.find(i => i.itemKey === "bread")?.quantity ?? 0;
  const beerStock = snapshot.inventory.find(i => i.itemKey === "beer")?.quantity ?? 0;
  const sold = (progress?.beerSold ?? 0) + (progress?.breadSold ?? 0);
  // Until an old save has a baseline, never treat lifetime totals as level-6 progress.
  const level6Produced = Math.max(0, produced - (stats.level6Baseline?.produced ?? produced));
  const level6Sold = Math.max(0, sold - (stats.level6Baseline?.sold ?? sold));
  const completed = snapshot.buildings.filter(b => Date.parse(b.completesAt) <= now);
  const ground = snapshot.groundItems.filter(i => i.itemKey === "barley" && i.expiresAt !== null && Date.parse(i.expiresAt) > now);
  const groundBarley = ground.reduce((sum, i) => sum + i.quantity, 0);
  const granaryBarley = completed.filter(b => b.type === "granary").reduce((sum, b) => sum + b.storedBarley, 0);
  const farmBarley = snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0;
  const carried = snapshot.farm.carriedItem;
  const carriedBarley = carried?.itemKey === "barley" && carried.expiresAt !== null && Date.parse(carried.expiresAt) > now ? carried.quantity : 0;
  const plantedBarley = snapshot.crops.some(c => c.cropKey === "barley" && Date.parse(c.plantedAt) <= now);
  // Existing harvests demonstrate completion of the introductory farming loop.
  const firstBarley = stats.plantedFirstBarley || plantedBarley || stats.harvests > 0 || stats.harvestedBarley > 0;
  const firstCanal = stats.builtFirstCanal || firstBarley || getRiverConnectedCanals(
    snapshot.improvements.filter(i => i.type === "irrigation" && Date.parse(i.completesAt) <= now)
  ).length > 0;
  const requirement = (label: string, current: number, required: number) => ({ label, current, required, met: current >= required });
  const requirements = match(level)
    .with(1, () => [requirement("Build an irrigation canal", firstCanal ? 1 : 0, 1),
      requirement("Plant your first barley field", firstBarley ? 1 : 0, 1),
      requirement("Barley harvested yourself", stats.harvestedBarley, 5), requirement("Barley on the ground (offering)", groundBarley, 5)])
    .with(2, () => [requirement("Completed granaries", completed.filter(b => b.type === "granary").length, 1), requirement("Barley in granaries (offering)", granaryBarley, 10)])
    .with(3, () => [requirement("Barley sold", progress?.barleySold ?? 0, 5),
      requirement("Crop plantings harvested", Math.max(0, stats.harvests - (stats.level3Baseline?.harvests ?? stats.harvests)), LEVEL_4_REQUIRED_HARVESTS),
      requirement("Barley in a full granary (offering)", Math.max(0, ...completed.filter(b => b.type === "granary").map(b => b.storedBarley)), LEVEL_4_BARLEY_OFFERING),
      requirement("Ground barley or an already-planted barley field", groundBarley > 0 || plantedBarley ? 1 : 0, 1)])
    .with(4, () => [requirement("Stored fish (offering)", snapshot.inventory.find(i => i.itemKey === "fish")?.quantity ?? 0, 3), requirement("Fish given to the farmer", stats.fishFed, 1), requirement("Barley in granaries (offering)", granaryBarley, LEVEL_5_BARLEY_OFFERING)])
    .with(5, () => [requirement("Completed Mills", completed.filter(b => b.type === "mill").length, 1),
      requirement("Crop plantings harvested", stats.harvests, LEVEL_6_REQUIRED_HARVESTS),
      requirement("Barley processed into Flour or Brewer's Groats", stats.processedBarley ?? 0, LEVEL_6_PROCESSED_BARLEY),
      requirement("Flour or Brewer's Groats (combined offering)", snapshot.inventory.filter(i => i.itemKey === "flour" || i.itemKey === "brewersGroats").reduce((sum, i) => sum + i.quantity, 0), LEVEL_6_PROCESSED_GOODS_OFFERING)])
    .with(6, () => [requirement("Bread or beer produced at level 6", level6Produced, LEVEL_7_REQUIRED_PRODUCTION), requirement("Bread or beer sold at level 6", level6Sold, LEVEL_7_REQUIRED_SALES),
      requirement("Stored bread or beer (combined offering)", breadStock + beerStock, LEVEL_7_FOOD_OFFERING)])
    .with(7, () => [requirement("Merchant requests fulfilled", progress?.requestsDelivered ?? 0, 3),
      requirement("Barley in the granary (offering)", granaryBarley, LEVEL_8_REQUIRED_GRANARY_BARLEY),
      requirement("Mill donkey purchased", snapshot.inventory.find(i => i.itemKey === "donkey")?.quantity ?? 0, 1)])
    .with(8, () => [
      requirement("Built a warehouse", completed.filter(b => b.type === "warehouse").length, 1),
      requirement("Barley harvested since reaching level 8", level8Barley, LEVEL_9_REQUIRED_BARLEY),
      requirement("Beer/bread produced during level 8", level8Produced, LEVEL_9_REQUIRED_PRODUCTION),
      requirement("Bread or beer in stock (10 of one kind, offering)", Math.max(breadStock, beerStock), LEVEL_9_FOOD_OFFERING)
    ])
    .otherwise(() => []);
  const offerings: readonly LevelOffering[] = match(level)
    .with(1, () => [{ source: "ground_barley" as const, quantity: 5 }])
    .with(2, () => [{ source: "granary_barley" as const, quantity: 10 }])
    .with(3, () => [{ source: "granary_barley" as const, quantity: LEVEL_4_BARLEY_OFFERING }])
    .with(4, () => [{ source: "fish" as const, quantity: 3 }, { source: "granary_barley" as const, quantity: LEVEL_5_BARLEY_OFFERING }])
    .with(5, () => [{ source: "processed_grain" as const, quantity: LEVEL_6_PROCESSED_GOODS_OFFERING }])
    .with(6, () => [{ source: "prepared_food" as const, quantity: LEVEL_7_FOOD_OFFERING }])
    .with(7, () => [{ source: "granary_barley" as const, quantity: LEVEL_8_REQUIRED_GRANARY_BARLEY }])
    .with(8, () => [{ source: breadStock >= LEVEL_9_FOOD_OFFERING ? "bread" as const : "beer" as const, quantity: LEVEL_9_FOOD_OFFERING }])
    .otherwise(() => []);
  const barleyCost = offerings.reduce((sum, offering) => sum + (offering.source === "ground_barley" || offering.source === "granary_barley" ? offering.quantity : 0), 0);
  const seedSafe = level === 3 ? groundBarley > 0 || plantedBarley
    : barleyCost === 0 || plantedBarley || groundBarley + granaryBarley + farmBarley + carriedBarley > barleyCost;
  return { level, nextLevel: level + 1, requirements, offerings, barleyCost, seedSafe,
    upcoming: level >= MAX_PLAYABLE_LEVEL,
    canClaim: level < MAX_PLAYABLE_LEVEL && seedSafe && requirements.every(r => r.met) };
};
