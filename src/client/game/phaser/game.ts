import Phaser from "phaser";
import { match } from "ts-pattern";
import { createGameConfig, GAME_CONTAINER_ID, TILE_SIZE } from "./config";
import type { Tile } from "./types";
import { interactionStore } from "./stores/interactionStore";

export const createGame = (
  scene: Phaser.Types.Scenes.SceneType,
  parent: HTMLElement | string = GAME_CONTAINER_ID
): Phaser.Game => new Phaser.Game(createGameConfig(scene, parent));

// HANDLES PHASER POINTER UP EVENT
export const handlePointerUp = (
  tile: Tile,
  selectionHighlight: Phaser.GameObjects.Rectangle
) => {
  const visibility = interactionStore.getState().selectedTile?.id !== tile.id;

  match(tile.type)
    .with("ground", () => {
      console.log(`Ground tile clicked: ${JSON.stringify(tile)}`);

      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with("groundVariant", () => {
      console.log(`Farm tile clicked: ${JSON.stringify(tile)}`);

      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with("harvestedBarley", () => {
      console.log(`Harvested barley clicked: ${JSON.stringify(tile)}`);

      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with("farm", () => {
      console.log(`Farm building clicked`);

      // the farm tile is 2x2, the width and height must be updated
      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE * 2, TILE_SIZE * 2)
        .setVisible(visibility);
    })
    .with("water", () => {
      console.log(`Water tile clicked`);

      selectionHighlight
        .setPosition(
          tile.position.column * TILE_SIZE,
          tile.position.row * TILE_SIZE
        )
        .setSize(TILE_SIZE, TILE_SIZE)
        .setVisible(visibility);
    })
    .with("farmerIdle0", () => {
      console.log(`Farmer clicked`);

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
