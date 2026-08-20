import { useEffect } from "react";
import { Popover } from "radix-ui";
import { match } from "ts-pattern";
import styles from "../styles/GameCanvas.module.scss";
import { GAME_CONTAINER_ID, TILE_SIZE } from "../game/phaser/config";
import { createGame } from "../game/phaser/game";
import { MainScene } from "../game/phaser/scenes/MainScene";
import { useStore } from "zustand";
import { gridStore } from "../game/phaser/stores/gridStore";
import { interactionStore } from "../game/phaser/stores/interactionStore";
import {
  farmerCommandStore,
  type FarmerCommandInput
} from "../game/phaser/stores/farmerCommandStore";
import type { Tile } from "../game/phaser/types";

if (import.meta.hot) {
  import.meta.hot.accept(
    [
      "../game/phaser/config",
      "../game/phaser/game",
      "../game/phaser/scenes/MainScene"
    ],
    () => {
      window.location.reload();
    }
  );
}

export default function GameCanvas() {
  const selectedTile = useStore(interactionStore, state => state.selectedTile);

  const clearSelection = useStore(
    interactionStore,
    state => state.clearSelection
  );

  const isOpenTilePopover = selectedTile !== null;

  const selectedTileSize =
    selectedTile?.type === "farm" ? TILE_SIZE * 2 : TILE_SIZE;

  const showPopoverBelow =
    selectedTile !== null && selectedTile.position.row <= 3;

  const tilePopoverX =
    selectedTile === null
      ? 0
      : selectedTile.position.posX + selectedTileSize / 2;

  const tilePopoverY =
    selectedTile === null
      ? 0
      : selectedTile.position.posY + (showPopoverBelow ? selectedTileSize : 0);

  const addCommand = (command: FarmerCommandInput): void => {
    farmerCommandStore.getState().addCommand(command);
    clearSelection();
  };

  const displayPopoverContent = (tile: typeof selectedTile) => {
    if (!tile) return <span>No tile selected</span>;

    return match(tile.type)
      .with("ground", () => {
        // there is a "build irrigation" button if the tile is next to a water tile
        // there is an "inspect" button otherwise
        const adjacentTiles = gridStore
          .getState()
          .findAdjacentTiles(tile.position);
        const waterTile: Tile | undefined = Object.entries(adjacentTiles).find(
          ([, tile]) => tile.type === "water"
        )?.[1];
        const button = waterTile ? (
          <button
            onClick={() =>
              addCommand({
                type: "build",
                target: tile.position,
                build: "irrigation"
              })
            }
          >
            Build Irrigation
          </button>
        ) : (
          <button
            onClick={() =>
              addCommand({
                type: "inspect",
                target: tile
              })
            }
          >
            Inspect
          </button>
        );

        return (
          <div className={styles["tile-popover-content"]}>
            <div className={styles["tile-popover-content-header"]}>
              <span className="cuneiforms">𒅖</span>
              <span>Ground</span>
            </div>
            <div className={styles["tile-popover-content-body"]}>
              Dry, sterile soil
              {button}
            </div>
          </div>
        );
      })
      .with("groundVariant", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒄒</span>
            <span>Arable ground</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            Fertile soil suitable for farming
            <button
              onClick={() => {
                // TODO: the button will change if the farmer has picked a crop before or not
                addCommand({
                  type: "inspect",
                  target: tile
                });
              }}
            >
              Inspect
            </button>
          </div>
        </div>
      ))
      .with("harvestedBarley", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒊺</span>
            <span>Barley</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            What would you like to do?
            <button
              onClick={() =>
                addCommand({
                  type: "pickup",
                  target: tile.position,
                  item: "barley"
                })
              }
            >
              Sow
            </button>
            {/* the Sell button is just a placeholder for now */}
            <button>Sell</button>
          </div>
        </div>
      ))
      .with("farm", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒂍</span>
            <span>Farm</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            A building used for agricultural activities
          </div>
        </div>
      ))
      .with("water", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒀀</span>
            <span>Water</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            A body of water
          </div>
        </div>
      ))
      .with("farmerIdle0", () => (
        <div className={styles["tile-popover-content"]}>
          <div className={styles["tile-popover-content-header"]}>
            <span className="cuneiforms">𒀳</span>
            <span>Farmer</span>
          </div>
          <div className={styles["tile-popover-content-body"]}>
            A farmer tending to the fields
          </div>
        </div>
      ))
      .otherwise(() => <span>Unknown tile</span>);
  };

  useEffect(() => {
    const game = createGame(MainScene);

    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <div className={styles["canvas"]}>
      <div id={GAME_CONTAINER_ID} className={styles["game-container"]} />
      <Popover.Root
        key={selectedTile?.id ?? "no-selection"}
        open={isOpenTilePopover}
        onOpenChange={open => {
          if (!open) {
            clearSelection();
          }
        }}
      >
        <Popover.Anchor asChild>
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: tilePopoverX,
              top: tilePopoverY,
              width: 0,
              height: 0,
              pointerEvents: "none"
            }}
          />
        </Popover.Anchor>

        <Popover.Portal>
          <Popover.Content
            className={styles["tile-popover"]}
            side={showPopoverBelow ? "bottom" : "top"}
            align="center"
            sideOffset={10}
            collisionPadding={12}
            avoidCollisions={!showPopoverBelow}
            onInteractOutside={event => {
              event.preventDefault();
            }}
          >
            {displayPopoverContent(selectedTile)}

            <Popover.Arrow className={styles["tile-popover-arrow"]} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
