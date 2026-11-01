import { createStore } from "zustand/vanilla";

export type MarketScope = "barley" | "beer" | "bread" | "produce" | "supplies";
export const MARKET_TITLES: Record<MarketScope, string> = {
  barley: "Barley market", beer: "Beer market", bread: "Baking market", produce: "Produce and provisions", supplies: "Supplies and equipment"
};
/** Stable ordering within the supplies catalogue. */
export const suppliesMarketBuyOrder = (itemKey: string): number =>
  ({ emptyBeerJar: 0, bakingTools: 1, brewingVessels: 2, donkey: 3 }[itemKey] ?? 4);
export const marketIncludesItem = (
  scope: MarketScope,
  itemKey: string,
  trade?: { readonly market: "npc" | "player"; readonly action: "buy" | "sell" }
): boolean =>
  scope === itemKey ||
  (scope === "produce" && (itemKey === "dates" || itemKey === "sesame" || itemKey === "oil")) ||
  (scope === "bread" && itemKey === "flour") ||
  (scope === "beer" && itemKey === "brewersGroats") ||
  (scope === "supplies" && ["emptyBeerJar", "brewingVessels", "bakingTools", "donkey"].includes(itemKey) &&
    (!trade || (trade.market === "npc" && trade.action === "buy")));


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
