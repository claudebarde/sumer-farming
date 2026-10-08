import { createStore } from "zustand/vanilla";
import type { TradeHistory } from "../../schemas/tradeHistory";
import type { FarmBuildingType } from "../../game-data/buildings";

export type TradeNotification = TradeHistory["trades"][number];
export type LevelNotification = { readonly id: string; readonly type: "level_up"; readonly level: number };
export type BuildingReadyNotification = { readonly id: string; readonly type: "building_ready"; readonly building: FarmBuildingType };
export type GameNotification = TradeNotification | LevelNotification | BuildingReadyNotification;

type State = {
  readonly playerId: string | null;
  readonly pending: readonly GameNotification[];
  readonly announced: ReadonlySet<string>;
  readonly setPlayer: (playerId: string | null) => void;
  readonly notifyTrade: (playerId: string, trade: TradeNotification) => void;
  readonly notifyLevel: (playerId: string, farmId: string, level: number) => void;
  readonly notifyBuilding: (playerId: string, farmId: string, building: FarmBuildingType) => void;
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
  notifyLevel: (playerId, farmId, level) => set(state => {
    const id = `level:${farmId}:${level}`;
    return state.playerId !== playerId || state.announced.has(id) ? state : {
      pending: [{ id, type: "level_up", level }, ...state.pending],
      announced: new Set([...state.announced, id])
    };
  }),
  dismiss: id => set(state => ({ pending: state.pending.filter(trade => trade.id !== id) })),
  notifyBuilding: (playerId, farmId, building) => set(state => {
    const id = `building-ready:${farmId}:${building}`;
    return state.playerId !== playerId || state.announced.has(id) ? state : {
      pending: [...state.pending, { id, type: "building_ready", building }],
      announced: new Set([...state.announced, id])
    };
  })
}));

export const notificationStore = createNotificationStore();
