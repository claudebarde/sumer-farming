import Phaser from "phaser";
import { match } from "ts-pattern";
import { createGameConfig, GAME_CONTAINER_ID, TILE_SIZE } from "./config";
import type { Tile } from "./types";
import { interactionStore } from "../../stores/interactionStore";
import { buildingPlacementStore } from "../../stores/buildingPlacementStore";
import { MarketScene } from "./scenes/MarketScene";

export const createGame = (
  scene: Phaser.Types.Scenes.SceneType,
  parent: HTMLElement | string = GAME_CONTAINER_ID
): Phaser.Game => new Phaser.Game({ ...createGameConfig(scene, parent), scene: [scene, MarketScene] });

// HANDLES PHASER POINTER UP EVENT
export const handlePointerUp = (
  tile: Tile,
  selectionHighlight: Phaser.GameObjects.Rectangle
) => {
  if (buildingPlacementStore.getState().placement.type !== "idle") {
    return;
  }

  const visibility = interactionStore.getState().selectedTile?.id !== tile.id;

  match(tile.type)
    .with("ground", () => {
      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with("groundVariant", () => {
      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with("harvestedBarley", () => {
      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with("reedBundle", "brickPile", "reeds", () => {
      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with("barleySeeded", "barleyGrowing", "barleyReady", () => {
      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with("farm", () => {
      // the farm tile is 2x2, the width and height must be updated
      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE * 2, TILE_SIZE * 2)
        .setVisible(visibility);
    })
    .with("granary", "brewery", "mill", () => {
      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE * 2, TILE_SIZE * 2)
        .setVisible(visibility);
    })
    .with("water", "groundPathHorizontal", () => {
      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with(
      "canalBridge",
      "canalHorizontal",
      "canalVertical",
      "canalCorner",
      "canalCross",
      "canalTJunction",
      () => {
        selectionHighlight
          .setPosition(
            tile.position.column * TILE_SIZE,
            tile.position.row * TILE_SIZE
          )
          .setSize(TILE_SIZE, TILE_SIZE)
          .setVisible(visibility);
      }
    )
    .with("farmerIdle0", () => {
      selectionHighlight
        .setPosition(tile.position.posX, tile.position.posY)
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .otherwise(() => {
      console.log(`Unknown tile clicked: ${JSON.stringify(tile)}`);
    });

  if (visibility) {
    interactionStore.getState().selectTile(tile);
  } else {
    interactionStore.getState().clearSelection();
  }
};
