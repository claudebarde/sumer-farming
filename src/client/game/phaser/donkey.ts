import type Phaser from "phaser";
import { spriteName } from "../../../assets/farmSprites";
import { TILE_SIZE } from "./config";
import { positionAlongPorterPath } from "./porterPresentation";
import type { MillingJob } from "../../../game-data/milling";

export type DonkeyTile = { readonly column: number; readonly row: number };
type Point = { readonly x: number; readonly y: number };

/** Reuse the safe escort route in reverse; never tween straight across the farm. */
export const donkeyReturnPath = (job: MillingJob): readonly DonkeyTile[] => {
  const journey = job.preparation;
  if (journey?.donkeyPickupIndex === undefined || journey.donkeyDropIndex === undefined) return [];
  return journey.path.slice(journey.donkeyPickupIndex, journey.donkeyDropIndex + 1).reverse();
};

export const shouldAnimateDonkeyReturn = (completesAt: number, visibleSince: number, now: number) =>
  completesAt >= visibleSince && completesAt <= now;

/** Trail along the actual route, so turns never cut through building corners. */
export const followingDonkeyPosition = (
  path: readonly DonkeyTile[], pickupIndex: number, dropIndex: number, farmerStep: number
) => {
  const step = Math.max(pickupIndex, Math.min(dropIndex, farmerStep - 0.6));
  const denominator = Math.max(1, path.length - 1);
  const position = positionAlongPorterPath(path, step / denominator);
  const previous = positionAlongPorterPath(path, Math.max(pickupIndex, step - 0.01) / denominator);
  return { position, flipX: position.column === previous.column ? undefined : position.column < previous.column };
};

export const adjacentGrazingTiles = (position: DonkeyTile, available: readonly DonkeyTile[]) =>
  available.filter(tile => Math.abs(tile.column - position.column) + Math.abs(tile.row - position.row) === 1);

/** Presentation only: ownership and milling deadlines remain server-authoritative. */
export const createDonkey = (scene: Phaser.Scene) => {
  const image = scene.add.image(0, 0, spriteName("donkey"))
    .setOrigin(0.5, 1).setDisplaySize(TILE_SIZE * 0.9, TILE_SIZE * 0.75).setVisible(false);
  let movement: Phaser.Tweens.Tween | null = null;
  const stop = () => { movement?.stop(); movement = null; image.setAngle(0); };
  const move = (point: Point, duration: number, onComplete?: () => void) => {
    stop();
    if (point.x !== image.x) image.setFlipX(point.x < image.x);
    movement = scene.tweens.add({
      targets: image, x: point.x, y: point.y, duration, ease: "Linear",
      onUpdate: () => image.setAngle(Math.sin(scene.time.now / 85) * 2),
      onComplete: () => { movement = null; image.setAngle(0); onComplete?.(); }
    });
  };
  return { image, move, stop, isMoving: () => movement !== null,
    destroy: () => { stop(); image.destroy(); } };
};
