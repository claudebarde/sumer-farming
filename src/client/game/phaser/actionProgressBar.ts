import type Phaser from "phaser";
import { ACTION_PROGRESS as bar, actionProgressFraction } from "../../../game-data/actionProgress";

/** Positions differ per action; size, colours, border and fill never do. */
export const drawActionProgress = (graphics: Phaser.GameObjects.Graphics, x: number, y: number, fraction: number) =>
  graphics.fillStyle(bar.track).fillRoundedRect(x - bar.width / 2, y, bar.width, bar.height, bar.radius)
    .fillStyle(bar.fill).fillRect(x - bar.width / 2 + bar.inset, y + bar.inset,
      (bar.width - 2 * bar.inset) * actionProgressFraction(fraction), bar.height - 2 * bar.inset);
