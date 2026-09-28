import { createStore } from "zustand/vanilla";
import type { NpcRequests } from "../../schemas/npcRequests";

type State = {
  readonly board: NpcRequests | null;
  readonly clockOffset: number;
  readonly isOpen: boolean;
  readonly setBoard: (board: NpcRequests) => void;
  readonly setOpen: (open: boolean) => void;
  readonly reset: () => void;
};
export const merchantUiStore = createStore<State>()(set => ({
  board: null, clockOffset: 0, isOpen: false,
  setBoard: board => set({ board, clockOffset: Date.parse(board.serverNow) - Date.now() }),
  setOpen: isOpen => set({ isOpen }),
  reset: () => set({ board: null, clockOffset: 0, isOpen: false })
}));
