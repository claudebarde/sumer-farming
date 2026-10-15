import { createStore } from "zustand/vanilla";
import type { TradeHistory } from "../../schemas/tradeHistory";
import type { FarmBuildingType } from "../../game-data/buildings";

export type TradeNotification = TradeHistory["trades"][number];
export type LevelNotification = { readonly id: string; readonly type: "level_up"; readonly level: number };
export type BuildingReadyNotification = { readonly id: string; readonly type: "building_ready"; readonly building: FarmBuildingType };
export type GameNotification = TradeNotification | LevelNotification | BuildingReadyNotification | { readonly id: string; readonly type: "action_error"; readonly message: string };

type State = {
  readonly playerId: string | null;
  readonly pending: readonly GameNotification[];
  readonly announced: ReadonlySet<string>;
  readonly materialDropFarmId: string | null;
  readonly setMaterialDrop: (farmId: string | null) => void;
  readonly setPlayer: (playerId: string | null) => void;
  readonly notifyTrade: (playerId: string, trade: TradeNotification) => void;
  readonly notifyLevel: (playerId: string, farmId: string, level: number) => void;
  readonly notifyBuilding: (playerId: string, farmId: string, building: FarmBuildingType, version?: number) => void;
  readonly dismiss: (id: string) => void;
  readonly notifyError: (message: string) => void;
};

export const createNotificationStore = () => createStore<State>()(set => ({
  playerId: null,
  notifyError: message => set(state => ({ pending: [{ id: crypto.randomUUID(), type: "action_error", message }, ...state.pending] })),
  pending: [],
  announced: new Set(),
  materialDropFarmId: null,
  setMaterialDrop: farmId => set({ materialDropFarmId: farmId }),
  setPlayer: playerId => set(state => state.playerId === playerId ? state : {
    playerId, pending: [], announced: new Set(), materialDropFarmId: null
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
  notifyBuilding: (playerId, farmId, building, version) => set(state => {
    const id = `building-ready:${farmId}:${building}${version === undefined ? "" : `:${version}`}`;
    return state.playerId !== playerId || state.announced.has(id) ? state : {
      pending: [...state.pending, { id, type: "building_ready", building }],
      announced: new Set([...state.announced, id])
    };
  })
}));

export const notificationStore = createNotificationStore();
