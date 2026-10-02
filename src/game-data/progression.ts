export const INITIAL_PROGRESSION_STATS = {
  harvestedBarley: 0,
  harvests: 0,
  beerProduced: 0,
  breadProduced: 0,
  fishFed: 0,
  processedBarley: 0
};
export type ProgressionStats = typeof INITIAL_PROGRESSION_STATS & {
  readonly level6Baseline?: {
    readonly produced: number;
    readonly sold: number;
  };
};
export const MAX_PLAYABLE_LEVEL = 8;
export const LEVEL_4_REQUIRED_HARVESTS = 50;
export const LEVEL_6_REQUIRED_HARVESTS = LEVEL_4_REQUIRED_HARVESTS * 2;
export const LEVEL_7_REQUIRED_PRODUCTION = 15;
export const LEVEL_7_REQUIRED_SALES = 10;
export const LEVEL_8_REQUIRED_GRANARY_BARLEY = 20;
export const LEVEL_4_BARLEY_OFFERING = 15;
export const LEVEL_5_BARLEY_OFFERING = 15;
export const LEVEL_NAMES = [
  "",
  "First plot",
  "Grain keeper",
  "Grain trader",
  "River provider",
  "Caring household",
  "Brewer or Baker?",
  "Trusted supplier",
  "Growing estate",
  "Established producer",
  "Community member"
] as const;
export const LEVEL_UNLOCK_ITEMS = [
  [],
  ["Irrigation", "Barley", "Farm storage"],
  ["First granary"],
  ["Barley market"],
  ["Fishing", "Fish storage"],
  ["Mill", "Barley processing"],
  [
    "Brewery",
    "Bread Oven",
    "Brewing supplies",
    "Bread making",
    "Beer trading",
    "Bread trading"
  ],
  [
    "Merchant requests",
    "Increased granary capacity (20 barley per granary)",
    "Mill donkey (30 shekels at the Baking market)"
  ],
  ["Second granary", "Small shrine"],
  ["Brewery expansion (upcoming)"],
  ["Neighbourhood and cooperative projects (upcoming)"]
] as const;
// Notifications use the same unlock definitions in a compact sentence.
export const LEVEL_UNLOCKS = LEVEL_UNLOCK_ITEMS.map(items => items.join(", "));
export const PROGRESSION_SIGNPOST = { column: 0, row: 4 } as const;
export const isProgressionSignpost = (position: {
  readonly column: number;
  readonly row: number;
}) =>
  position.column === PROGRESSION_SIGNPOST.column &&
  position.row === PROGRESSION_SIGNPOST.row;
export const MARKET_UNLOCK_LEVEL = 3;
export const BREWERY_UNLOCK_LEVEL = 6;
export const BREAD_OVEN_UNLOCK_LEVEL = 6;
export const canEnterMarket = (level: number = 1) =>
  level >= MARKET_UNLOCK_LEVEL;
export const marketUnlockLevel = (item: string) =>
  item === "barley"
    ? MARKET_UNLOCK_LEVEL
    : item === "donkey"
      ? 7
      : item === "flour" || item === "brewersGroats"
        ? 5
        : item === "bread" || item === "bakingTools"
          ? BREAD_OVEN_UNLOCK_LEVEL
          : BREWERY_UNLOCK_LEVEL;
export const marketStandUnlockLevel = (scope: "barley" | "beer" | "bread") =>
  scope === "barley" ? MARKET_UNLOCK_LEVEL : 5;
export const canOpenMarketStand = (
  scope: "barley" | "beer" | "bread",
  level: number = 1
) => level >= marketStandUnlockLevel(scope);
export const granaryLimitForLevel = (level: number) =>
  level < 2 ? 0 : level < 8 ? 1 : 2;
