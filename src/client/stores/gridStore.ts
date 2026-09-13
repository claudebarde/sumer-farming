import { createStore } from "zustand/vanilla";
import type { Tile, TilePosition } from "../game/phaser/types";

export type GridCoordinate = Pick<TilePosition, "row" | "column">;

export type GridEntry = {
  readonly tile: Tile;
  readonly coordinate: GridCoordinate;
};

type AdjacentTiles = {
  top?: Tile;
  bottom?: Tile;
  left?: Tile;
  right?: Tile;
};

type State = {
  readonly grid: Tile[][];
  readonly replaceGrid: (entries: readonly GridEntry[]) => void;
  readonly findAdjacentTiles: (coordinate: GridCoordinate) => AdjacentTiles;
};

export const gridStore = createStore<State>()(set => ({
  grid: [],

  replaceGrid: entries => {
    const grid: Tile[][] = [];

    for (const { tile, coordinate } of entries) {
      const row = [...(grid[coordinate.row] ?? [])];
      row[coordinate.column] = tile;
      grid[coordinate.row] = row;
    }

    set({ grid });
  },

  findAdjacentTiles: ({ row, column }): AdjacentTiles => {
    const state = gridStore.getState();
    const grid = state.grid;
    return {
      top: grid[row - 1]?.[column],
      bottom: grid[row + 1]?.[column],
      left: grid[row]?.[column - 1],
      right: grid[row]?.[column + 1]
    };
  }
}));
