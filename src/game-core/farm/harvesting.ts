export type HarvestStartValidation =
  | { readonly type: "valid" }
  | { readonly type: "crop_not_ready" }
  | { readonly type: "crop_already_harvesting" }
  | { readonly type: "hands_not_empty" };

export type HarvestCompletionValidation =
  | { readonly type: "valid" }
  | { readonly type: "harvest_not_started" }
  | { readonly type: "harvest_not_complete" }
  | { readonly type: "hands_not_empty" };

type HarvestStartContext = {
  readonly now: number;
  readonly growthCompletesAt: number;
  readonly harvestStartedAt: number | null;
  readonly carriedItemQuantity: number;
};

type HarvestCompletionContext = {
  readonly now: number;
  readonly harvestCompletesAt: number | null;
  readonly carriedItemQuantity: number;
};

export const validateHarvestStart = (
  context: HarvestStartContext
): HarvestStartValidation => {
  if (context.carriedItemQuantity !== 0) {
    return { type: "hands_not_empty" };
  }

  if (context.harvestStartedAt !== null) {
    return { type: "crop_already_harvesting" };
  }

  if (context.now < context.growthCompletesAt) {
    return { type: "crop_not_ready" };
  }

  return { type: "valid" };
};

export const validateHarvestCompletion = (
  context: HarvestCompletionContext
): HarvestCompletionValidation => {
  if (context.carriedItemQuantity !== 0) {
    return { type: "hands_not_empty" };
  }

  if (context.harvestCompletesAt === null) {
    return { type: "harvest_not_started" };
  }

  if (context.now < context.harvestCompletesAt) {
    return { type: "harvest_not_complete" };
  }

  return { type: "valid" };
};
