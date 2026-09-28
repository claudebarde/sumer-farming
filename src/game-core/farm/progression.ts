import { match } from "ts-pattern";
import type { FarmSnapshot } from "../../schemas/farm";
import { INITIAL_PROGRESSION_STATS, LEVEL_4_REQUIRED_HARVESTS, MAX_PLAYABLE_LEVEL } from "../../game-data/progression";

export type LevelOffering = { readonly source: "ground_barley" | "granary_barley" | "fish"; readonly quantity: number };
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
    .with(3, () => [requirement("Barley sold", progress?.barleySold ?? 0, 5), requirement("Crop plantings harvested", stats.harvests, LEVEL_4_REQUIRED_HARVESTS)])
    .with(4, () => [requirement("Stored fish (offering)", snapshot.inventory.find(i => i.itemKey === "fish")?.quantity ?? 0, 3), requirement("Fish given to the farmer", stats.fishFed, 1)])
    .with(5, () => [requirement("Completed breweries", completed.filter(b => b.type === "brewery").length, 1), requirement("Beer produced and collected or served", stats.beerProduced, 2)])
    .with(6, () => [requirement("Beer produced", stats.beerProduced, 6), requirement("Beer sold", progress?.beerSold ?? 0, 2)])
    .with(7, () => [requirement("Merchant requests fulfilled", progress?.requestsDelivered ?? 0, 3)])
    .with(8, () => [requirement("Completed granaries", completed.filter(b => b.type === "granary").length, 2), requirement("Barley harvested", stats.harvestedBarley, 50), requirement("Beer produced", stats.beerProduced, 12)])
    .otherwise(() => []);
  const offering: LevelOffering | null = match(level)
    .with(1, () => ({ source: "ground_barley" as const, quantity: 5 }))
    .with(2, () => ({ source: "granary_barley" as const, quantity: 10 }))
    .with(4, () => ({ source: "fish" as const, quantity: 3 }))
    .otherwise(() => null);
  const barleyCost = offering !== null && offering.source !== "fish" ? offering.quantity : 0;
  const seedSafe = barleyCost === 0 || plantedBarley || groundBarley + granaryBarley + farmBarley + carriedBarley > barleyCost;
  return { level, nextLevel: level + 1, requirements, offering, seedSafe,
    upcoming: level >= MAX_PLAYABLE_LEVEL,
    canClaim: level < MAX_PLAYABLE_LEVEL && seedSafe && requirements.every(r => r.met) };
};
