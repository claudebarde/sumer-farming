import { createStore } from "zustand/vanilla";
import type { Tile } from "../game/phaser/types";

type State = {
  readonly selectedTile: Tile | null;
  readonly selectTile: (tile: Tile) => void;
  readonly refreshSelectedTile: (tile: Tile) => void;
  readonly clearSelection: () => void;
};

export const interactionStore = createStore<State>()(set => ({
  selectedTile: null,

  selectTile: tile => {
    set({ selectedTile: tile });
  },

  refreshSelectedTile: tile => {
    set(state =>
      state.selectedTile?.id === tile.id ? { selectedTile: tile } : {}
    );
  },

  clearSelection: () => {
    set({ selectedTile: null });
  }
}));
