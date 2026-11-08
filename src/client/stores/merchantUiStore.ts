import { createStore } from "zustand/vanilla";
import type { NpcRequests } from "../../schemas/npcRequests";

type State = {
  readonly board: NpcRequests | null;
  readonly clockOffset: number;
  readonly isOpen: boolean;
  readonly departureAt: number | null;
  readonly setBoard: (board: NpcRequests) => void;
  readonly setOpen: (open: boolean) => void;
  readonly recordDelivery: (cycle: number, slot: number) => void;
  readonly reset: () => void;
};
export const merchantUiStore = createStore<State>()(set => ({
  board: null, clockOffset: 0, isOpen: false, departureAt: null,
  setBoard: board => set(state => {
    if (state.board && Date.parse(board.serverNow) < Date.parse(state.board.serverNow)) return state;
    const sameVisit = state.board?.cycle === board.cycle;
    return { board: sameVisit && state.board?.visitCompleted ? { ...board, visitCompleted: true } : board, clockOffset: Date.parse(board.serverNow) - Date.now(),
      departureAt: sameVisit ? state.departureAt ?? (board.visitCompleted && !state.board?.visitCompleted && !state.isOpen ? Date.parse(board.serverNow) : null) : null };
  }),
  setOpen: isOpen => set(state => ({ isOpen,
    departureAt: !isOpen && state.isOpen && state.board?.visitCompleted
      ? state.departureAt ?? Date.now() + state.clockOffset : state.departureAt })),
  recordDelivery: (cycle, slot) => set(state => {
    if (!state.board || state.board.cycle !== cycle) return state;
    const requests = state.board.requests.map(request => request.slot === slot ? { ...request, completed: true } : request);
    const visitCompleted = requests.length > 0 && requests.every(request => request.completed);
    return { board: { ...state.board, requests, visitCompleted },
      departureAt: visitCompleted && !state.isOpen ? state.departureAt ?? Date.now() + state.clockOffset : state.departureAt };
  }),
  reset: () => set({ board: null, clockOffset: 0, isOpen: false, departureAt: null })
}));
