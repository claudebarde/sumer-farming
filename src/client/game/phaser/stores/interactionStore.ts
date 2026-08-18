// game/bridge/tileSelectionStore.ts
import { createStore } from "zustand/vanilla";
import type { Tile } from "../types";

type State = {
  readonly selectedTile: Tile | null;
  readonly selectTile: (tile: Tile) => void;
  readonly clearSelection: () => void;
};

export const interactionStore = createStore<State>()(set => ({
  selectedTile: null,

  selectTile: tile => {
    set({ selectedTile: tile });
  },

  clearSelection: () => {
    set({ selectedTile: null });
  }
}));
