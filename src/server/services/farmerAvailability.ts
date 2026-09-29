import { Data } from "effect";

export class FarmerUnavailableError extends Data.TaggedError("FarmerUnavailableError")<{ readonly message: string }> {}

/** Called under the farm row lock before starting any other physical action. */
export const assertFarmerAvailable = (farm: { readonly fishing: unknown; readonly carriedItemKey: string | null; readonly milling?: unknown; readonly millGoods?: { readonly delivery: unknown } }) => {
  if (farm.millGoods?.delivery) throw new FarmerUnavailableError({ message: "Store the processed grain at the granary first." });
  if (farm.milling) throw new FarmerUnavailableError({ message: "The farmer is working in the Mill. Wait for milling to finish." });
  if (farm.fishing || farm.carriedItemKey === "fish") throw new FarmerUnavailableError({
    message: farm.fishing ? "Stop fishing before starting another activity." : "Store the fish at the farm or release it in the river first."
  });
};
