import { createStore } from "zustand/vanilla";

export type MarketScope = "barley" | "beer" | "bread" | "produce";
export const MARKET_TITLES: Record<MarketScope, string> = {
  barley: "Barley market", beer: "Beer market", bread: "Baking market", produce: "Fruit and vegetables"
};
/** Keep brewing equipment, packaging and finished beer together, in that order. */
export const beerMarketBuyOrder = (itemKey: string): number =>
  ({ brewingVessels: 0, emptyBeerJar: 1, beer: 2 }[itemKey] ?? 3);
export const marketIncludesItem = (
  scope: MarketScope,
  itemKey: string,
  trade?: { readonly market: "npc" | "player"; readonly action: "buy" | "sell" }
): boolean =>
  scope === itemKey ||
  (scope === "produce" && (itemKey === "dates" || itemKey === "sesame")) ||
  (scope === "bread" && itemKey === "flour") ||
  (scope === "beer" && itemKey === "brewersGroats") ||
  (scope === "bread" && (itemKey === "bakingTools" || itemKey === "donkey") && trade?.market === "npc" && trade.action === "buy") ||
  (scope === "beer" && (itemKey === "emptyBeerJar" || itemKey === "brewingVessels") &&
    trade?.market === "npc" && trade.action === "buy");

type State = {
  readonly location: "farm" | "market" | "sumer";
  readonly setLocation: (location: "farm" | "market" | "sumer") => void;
  readonly isOpen: boolean;
  readonly leaderboardOpen: boolean;
  readonly setLeaderboardOpen: (open: boolean) => void;
  readonly scope: MarketScope;
  readonly openMarket: (scope: MarketScope) => void;
  readonly setOpen: (isOpen: boolean) => void;
};

export const marketUiStore = createStore<State>()(set => ({
  location: "farm",
  setLocation: location => set({ location, isOpen: false, leaderboardOpen: false }),
  isOpen: false,
  leaderboardOpen: false,
  setLeaderboardOpen: leaderboardOpen => set(state => ({ leaderboardOpen: leaderboardOpen && state.location === "market", ...(leaderboardOpen ? { isOpen: false } : {}) })),
  scope: "barley",

  openMarket: scope => {
    set({ isOpen: true, scope, leaderboardOpen: false });
  },

  setOpen: isOpen => {
    set({ isOpen });
  }
}));

export const subscribeMarketOpening = (onOpen: () => void) => marketUiStore.subscribe((next, previous) => {
  if (next.isOpen && (!previous.isOpen || next.scope !== previous.scope)) onOpen();
});
