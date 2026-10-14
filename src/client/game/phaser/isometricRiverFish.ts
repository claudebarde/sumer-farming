import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { fishPosition } from "../../../game-core/farm/fishing";
import { isoPoint } from "./isometricProjection";
import { riverFishY } from "./riverFishMotion";
import { ISOMETRIC_RIVER_ROWS } from "./isometricRiver";
import type { FishingSession } from "../../../game-data/fishing";
import { blendFishPosition } from "./riverFishMotion";
import type { IsoCell } from "./isometricProjection";

/** Four-tile fishing area using the exact server-authoritative normalized path. */
export const fishingBounds = (column: number) => ({
  left: Math.max(config.worldBounds.minimumColumn - 0.5, Math.min(config.worldBounds.maximumColumn - 3.5, column - 2)),
  width: 4,
});
export const fishingAim = (column: number, selectedColumn: number): number | null => {
  const bounds = fishingBounds(selectedColumn);
  const aim = (column - bounds.left) / bounds.width;
  return aim >= 0 && aim <= 1 ? aim : null;
};
export const fishingAreaFish = (session: FishingSession, elapsed: number): IsoCell => ({
  column: fishingBounds(session.column).left + fishPosition(session.seed, elapsed) * 4,
  row: config.riverRow + 0.4 + Math.sin(elapsed / 3000) * 0.35,
});
export const blendRiverFish = (from: IsoCell, target: IsoCell, elapsed: number, duration: number): IsoCell => ({
  column: blendFishPosition(from.column, target.column, elapsed, duration),
  row: blendFishPosition(from.row, target.row, elapsed, duration),
});

export const RIVER_FISH_WIDTH = 36;
export const RIVER_FISH_HEIGHT = 24;
export const RIVER_FISH_ALPHA = 0.75;

/** Same slow roaming path as the flat farm, projected along the river, not the screen. */
export const isometricRiverFish = (seed: number, elapsed: number) => {
  const { minimumColumn, maximumColumn } = config.worldBounds;
  const column = minimumColumn + fishPosition(seed, elapsed / 7) * (maximumColumn - minimumColumn);
  // A gentle twelve-second sweep crosses both rows, with room for the entire
  // rotated sprite at either bank. East/west roaming retains its existing pace.
  const row = riverFishY(ISOMETRIC_RIVER_ROWS[0] - 0.5, ISOMETRIC_RIVER_ROWS.length, 0.7, elapsed / 3);
  const position = isoPoint({ column, row });
  // Compare segment endpoints so the fish keeps its heading during short pauses.
  const segmentStart = Math.floor(elapsed / (1600 * 7)) * 1600;
  const before = fishPosition(seed, segmentStart);
  const after = fishPosition(seed, segmentStart + 1600);
  return { ...position, column, row, flipX: after < before, rotation: Math.atan2(24, 48) };
};
