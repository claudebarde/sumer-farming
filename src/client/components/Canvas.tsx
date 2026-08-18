import { useEffect } from "react";
import { Popover } from "radix-ui";
import styles from "../styles/GameCanvas.module.scss";
import { GAME_CONTAINER_ID, TILE_SIZE } from "../game/phaser/config";
import { createGame } from "../game/phaser/game";
import { MainScene } from "../game/phaser/scenes/MainScene";
import { useStore } from "zustand";
import { interactionStore } from "../game/phaser/stores/interactionStore";

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
      : selectedTile.position.column * TILE_SIZE + selectedTileSize / 2;

  const tilePopoverY =
    selectedTile === null
      ? 0
      : selectedTile.position.row * TILE_SIZE +
        (showPopoverBelow ? selectedTileSize : 0);

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
            <span>{selectedTile?.type ?? "No tile selected"}</span>

            <Popover.Arrow className={styles["tile-popover-arrow"]} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
