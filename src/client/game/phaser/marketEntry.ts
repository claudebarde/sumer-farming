export const MARKET_UNLOAD_MESSAGE = "Unload your items before going to the market.";

export const isCarryingForMarket = (
  carriedItem: { readonly quantity: number } | null,
  carryingMillBags: boolean,
  carryingMillingBarley: boolean
): boolean => carriedItem !== null || carryingMillBags || carryingMillingBarley;
