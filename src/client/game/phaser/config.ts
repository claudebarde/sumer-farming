import Phaser from "phaser";
import type { GridSize } from "./types";

export const GAME_CONTAINER_ID = "game-container";

export const createGameConfig = (
  scene: Phaser.Types.Scenes.SceneType,
  parent: HTMLElement | string = GAME_CONTAINER_ID
): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  backgroundColor: "#1a2f1f",
  scene: [scene],
  dom: {
    createContainer: true
  },
  input: {
    windowEvents: false
  },
  scale: {
    parent,
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%"
  }
});

export const TILE_SIZE = 64;

export const gridSize: GridSize = {
  columns: 16,
  rows: 16
};
