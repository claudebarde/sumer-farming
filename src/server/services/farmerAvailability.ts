import { Data } from "effect";

export class FarmerUnavailableError extends Data.TaggedError("FarmerUnavailableError")<{ readonly message: string }> {}

/** Called under the farm row lock before starting any other physical action. */
export const assertFarmerAvailable = (farm: { readonly fishing: unknown; readonly carriedItemKey: string | null }) => {
  if (farm.fishing || farm.carriedItemKey === "fish") throw new FarmerUnavailableError({
    message: farm.fishing ? "Stop fishing before starting another activity." : "Store the fish at the farm or release it in the river first."
  });
};
