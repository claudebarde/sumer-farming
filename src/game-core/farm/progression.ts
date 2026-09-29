import { match } from "ts-pattern";
import { LEVEL_6_PROCESSED_BARLEY, LEVEL_6_PROCESSED_GOODS_OFFERING } from "../../game-data/milling";
import type { FarmSnapshot } from "../../schemas/farm";
import { INITIAL_PROGRESSION_STATS, LEVEL_4_REQUIRED_HARVESTS, LEVEL_6_REQUIRED_HARVESTS, LEVEL_4_BARLEY_OFFERING, LEVEL_5_BARLEY_OFFERING, MAX_PLAYABLE_LEVEL } from "../../game-data/progression";

export type LevelOffering = { readonly source: "ground_barley" | "granary_barley" | "fish" | "processed_grain"; readonly quantity: number };
export const evaluateProgression = (snapshot: FarmSnapshot, now: number) => {
  const progress = snapshot.farm.progression;
  const level = progress?.level ?? 1;
  const stats = progress?.stats ?? INITIAL_PROGRESSION_STATS;
  const completed = snapshot.buildings.filter(b => Date.parse(b.completesAt) <= now);
  const ground = snapshot.groundItems.filter(i => i.itemKey === "barley" && i.expiresAt !== null && Date.parse(i.expiresAt) > now);
  const groundBarley = ground.reduce((sum, i) => sum + i.quantity, 0);
  const granaryBarley = completed.filter(b => b.type === "granary").reduce((sum, b) => sum + b.storedBarley, 0);
  const farmBarley = snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0;
  const carried = snapshot.farm.carriedItem;
  const carriedBarley = carried?.itemKey === "barley" && carried.expiresAt !== null && Date.parse(carried.expiresAt) > now ? carried.quantity : 0;
  const plantedBarley = snapshot.crops.some(c => c.cropKey === "barley" && Date.parse(c.plantedAt) <= now);
  const requirement = (label: string, current: number, required: number) => ({ label, current, required, met: current >= required });
  const requirements = match(level)
    .with(1, () => [requirement("Barley harvested yourself", stats.harvestedBarley, 5), requirement("Barley on the ground (offering)", groundBarley, 5)])
    .with(2, () => [requirement("Completed granaries", completed.filter(b => b.type === "granary").length, 1), requirement("Barley in granaries (offering)", granaryBarley, 10)])
    .with(3, () => [requirement("Barley sold", progress?.barleySold ?? 0, 5),
      requirement("Crop plantings harvested", stats.harvests, LEVEL_4_REQUIRED_HARVESTS),
      requirement("Barley in a full granary (offering)", Math.max(0, ...completed.filter(b => b.type === "granary").map(b => b.storedBarley)), LEVEL_4_BARLEY_OFFERING),
      requirement("Ground barley or an already-planted barley field", groundBarley > 0 || plantedBarley ? 1 : 0, 1)])
    .with(4, () => [requirement("Stored fish (offering)", snapshot.inventory.find(i => i.itemKey === "fish")?.quantity ?? 0, 3), requirement("Fish given to the farmer", stats.fishFed, 1), requirement("Barley in granaries (offering)", granaryBarley, LEVEL_5_BARLEY_OFFERING)])
    .with(5, () => [requirement("Completed Mills", completed.filter(b => b.type === "mill").length, 1),
      requirement("Crop plantings harvested", stats.harvests, LEVEL_6_REQUIRED_HARVESTS),
      requirement("Barley processed into Flour or Brewer's Groats", stats.processedBarley ?? 0, LEVEL_6_PROCESSED_BARLEY),
      requirement("Flour or Brewer's Groats (combined offering)", snapshot.inventory.filter(i => i.itemKey === "flour" || i.itemKey === "brewersGroats").reduce((sum, i) => sum + i.quantity, 0), LEVEL_6_PROCESSED_GOODS_OFFERING)])
    .with(6, () => [requirement("Beer produced", stats.beerProduced, 6), requirement("Beer sold", progress?.beerSold ?? 0, 2)])
    .with(7, () => [requirement("Merchant requests fulfilled", progress?.requestsDelivered ?? 0, 3)])
    .with(8, () => [requirement("Completed granaries", completed.filter(b => b.type === "granary").length, 2), requirement("Barley harvested", stats.harvestedBarley, 50), requirement("Beer produced", stats.beerProduced, 12)])
    .otherwise(() => []);
  const offerings: readonly LevelOffering[] = match(level)
    .with(1, () => [{ source: "ground_barley" as const, quantity: 5 }])
    .with(2, () => [{ source: "granary_barley" as const, quantity: 10 }])
    .with(3, () => [{ source: "granary_barley" as const, quantity: LEVEL_4_BARLEY_OFFERING }])
    .with(4, () => [{ source: "fish" as const, quantity: 3 }, { source: "granary_barley" as const, quantity: LEVEL_5_BARLEY_OFFERING }])
    .with(5, () => [{ source: "processed_grain" as const, quantity: LEVEL_6_PROCESSED_GOODS_OFFERING }])
    .otherwise(() => []);
  const barleyCost = offerings.reduce((sum, offering) => sum + (offering.source === "ground_barley" || offering.source === "granary_barley" ? offering.quantity : 0), 0);
  const seedSafe = level === 3 ? groundBarley > 0 || plantedBarley
    : barleyCost === 0 || plantedBarley || groundBarley + granaryBarley + farmBarley + carriedBarley > barleyCost;
  return { level, nextLevel: level + 1, requirements, offerings, barleyCost, seedSafe,
    upcoming: level >= MAX_PLAYABLE_LEVEL,
    canClaim: level < MAX_PLAYABLE_LEVEL && seedSafe && requirements.every(r => r.met) };
};
