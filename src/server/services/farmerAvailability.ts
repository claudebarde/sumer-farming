import { Data } from "effect";
import { roadIsComplete, type FarmRoad } from "../../game-data/roads";

export class FarmerUnavailableError extends Data.TaggedError("FarmerUnavailableError")<{ readonly message: string }> {}

/** Called under the farm row lock before starting any other physical action. */
export const assertFarmerAvailable = (farm: { readonly roads?: readonly FarmRoad[]; readonly fishing: unknown; readonly carriedItemKey: string | null; readonly milling?: { readonly worker?: "farmer" | "donkey" } | null; readonly millGoods?: { readonly delivery: unknown }; readonly production?: { readonly planting?: unknown; readonly delivery: unknown; readonly baking?: Readonly<Record<string, unknown>> } }) => {
  if (farm.production?.planting) throw new FarmerUnavailableError({ message: "Finish or stop planting or harvesting the selected fields first." });
  if (Object.keys(farm.production?.baking ?? {}).length > 0) throw new FarmerUnavailableError({ message: "The farmer is baking in the Bread Oven. Wait for baking to finish." });
  if (farm.roads?.some(r => !roadIsComplete(r, Date.now()))) throw new FarmerUnavailableError({ message: "The farmer is building a road. Wait for construction to finish." });
  if (farm.production?.delivery) throw new FarmerUnavailableError({ message: "Store the finished goods at the farm first." });
  if (farm.millGoods?.delivery) throw new FarmerUnavailableError({ message: "Store the processed grain at the farm first." });
  if (farm.milling && farm.milling.worker !== "donkey") throw new FarmerUnavailableError({ message: "The farmer is working in the Mill. Wait for milling to finish." });
  if (farm.fishing || farm.carriedItemKey === "fish") throw new FarmerUnavailableError({
    message: farm.fishing ? "Stop fishing before starting another activity." : "Store the fish at the farm or release it in the river first."
  });
};
