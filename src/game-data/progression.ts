export const INITIAL_PROGRESSION_STATS = { harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0, processedBarley: 0 };
export type ProgressionStats = typeof INITIAL_PROGRESSION_STATS;
export const MAX_PLAYABLE_LEVEL = 8;
export const LEVEL_4_REQUIRED_HARVESTS = 50;
export const LEVEL_6_REQUIRED_HARVESTS = LEVEL_4_REQUIRED_HARVESTS * 2;
export const LEVEL_4_BARLEY_OFFERING = 15;
export const LEVEL_5_BARLEY_OFFERING = 15;
export const LEVEL_NAMES = ["", "First plot", "Grain keeper", "Grain trader", "River provider", "Caring household", "Brewer or Baker?", "Trusted supplier", "Growing estate", "Established producer", "Community member"] as const;
export const LEVEL_UNLOCKS = ["", "Irrigation, barley and farm storage", "First granary", "Barley market", "Fishing and fish storage", "Mill and barley processing", "Brewery, brewing supplies and beer trading (Bread Oven upcoming)", "Merchant requests", "Second granary", "Brewery expansion (upcoming)", "Neighbourhood and cooperative projects (upcoming)"] as const;
export const PROGRESSION_SIGNPOST = { column: 0, row: 4 } as const;
export const isProgressionSignpost = (position: { readonly column: number; readonly row: number }) =>
  position.column === PROGRESSION_SIGNPOST.column && position.row === PROGRESSION_SIGNPOST.row;
export const MARKET_UNLOCK_LEVEL = 3;
export const canEnterMarket = (level: number = 1) => level >= MARKET_UNLOCK_LEVEL;
export const marketUnlockLevel = (item: string) => item === "barley" ? MARKET_UNLOCK_LEVEL : 6;
export const marketStandUnlockLevel = (scope: "barley" | "beer") =>
  marketUnlockLevel(scope === "barley" ? "barley" : "brewingVessels");
export const canOpenMarketStand = (scope: "barley" | "beer", level: number = 1) =>
  level >= marketStandUnlockLevel(scope);
export const granaryLimitForLevel = (level: number) => level < 2 ? 0 : level < 8 ? 1 : 2;
