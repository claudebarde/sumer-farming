import { createStore } from "zustand/vanilla";
import type { TradeHistory } from "../../schemas/tradeHistory";

export type TradeNotification = TradeHistory["trades"][number];

type State = {
  readonly playerId: string | null;
  readonly pending: readonly TradeNotification[];
  readonly announced: ReadonlySet<string>;
  readonly setPlayer: (playerId: string | null) => void;
  readonly notifyTrade: (playerId: string, trade: TradeNotification) => void;
  readonly dismiss: (id: string) => void;
};

export const createNotificationStore = () => createStore<State>()(set => ({
  playerId: null,
  pending: [],
  announced: new Set(),
  setPlayer: playerId => set(state => state.playerId === playerId ? state : {
    playerId, pending: [], announced: new Set()
  }),
  notifyTrade: (playerId, trade) => set(state =>
    state.playerId !== playerId || state.announced.has(trade.id) ? state : {
      pending: [...state.pending, trade],
      announced: new Set([...state.announced, trade.id])
    }
  ),
  dismiss: id => set(state => ({ pending: state.pending.filter(trade => trade.id !== id) }))
}));

export const notificationStore = createNotificationStore();
