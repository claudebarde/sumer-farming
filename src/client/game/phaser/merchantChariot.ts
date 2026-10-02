import Phaser from "phaser";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { spriteName } from "../../../assets/farmSprites";
import { merchantUiStore } from "../../stores/merchantUiStore";
import { getMerchantVisit } from "./merchantVisit";
import { TILE_SIZE } from "./config";
import { MERCHANT_CHARIOT_WIDTH_TILES } from "./merchantChariotLayout";

export const installMerchantChariot = (
  scene: Phaser.Scene,
  stopColumn: () => number,
  onMovingClick: () => void,
  onStoppedClick: () => void
): void => {
  const width = TILE_SIZE * MERCHANT_CHARIOT_WIDTH_TILES;
  const height = TILE_SIZE * 1.5;
  const halfWidth = width / 2;
  const chariot = scene.add.image(0, (INITIAL_FARM_CONFIG.roadRow + 0.6) * TILE_SIZE,
    spriteName("merchantChariot"))
    // Anchor the wheels/feet slightly below center to align the artwork to the road.
    .setOrigin(0.5, 1).setDisplaySize(width, height).setDepth(6)
    .setVisible(false).setInteractive({ useHandCursor: true });
  const visit = () => {
    const { board, clockOffset } = merchantUiStore.getState();
    return board ? getMerchantVisit(board, Date.now() + clockOffset) : { phase: "away" } as const;
  };
  const update = () => {
    const state = visit();
    chariot.setVisible(state.phase !== "away");
    const stop = stopColumn() * TILE_SIZE;
    switch (state.phase) {
      case "arriving": chariot.x = -halfWidth + (stop + halfWidth) * state.progress; break;
      case "stopped": chariot.x = stop; break;
      case "departing": chariot.x = stop + (scene.scale.width + halfWidth - stop) * state.progress; break;
      case "away": break;
    }
  };
  chariot.on(Phaser.Input.Events.POINTER_UP,
    (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const state = visit();
      if (state.phase === "stopped") {
        onStoppedClick();
        merchantUiStore.getState().setOpen(true);
      } else if (state.phase !== "away") onMovingClick();
    });
  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, update));
  update();
};
