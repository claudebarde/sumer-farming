export const FISH_CAPACITY = 5;
export const CAST_DELAY_MS = 400;
export const CAST_COOLDOWN_MS = 2000;
export const FISH_CATCH_RADIUS = 0.065;
export type FishingSession = {
  readonly id: string;
  readonly seed: number;
  readonly startedAt: number;
  readonly lastCastAt: number | null;
  readonly column: number;
  readonly row: number;
};
