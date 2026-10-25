export const PALM_TENDING_WINDOW_MS = 12 * 60 * 60_000;
export type PalmCycle = {
  readonly startedAt: number;
  readonly originalReadyAt: number;
  readonly tendedAt?: number;
};

export const palmTendingReason = (
  cycle: PalmCycle | undefined,
  readyAt: number,
  now: number
): string | null => {
  if (now >= readyAt) return "The dates are ready to harvest.";
  if (!cycle) return "Tending becomes available after the next harvest.";
  if (cycle.tendedAt !== undefined) return "This palm has already been tended.";
  if (now < cycle.startedAt) return "This growing cycle has not started yet.";
  if (now >= cycle.startedAt + PALM_TENDING_WINDOW_MS)
    return "The tending window has closed. The dates are ripening.";
  return null;
};
export const tendedPalmDeadline = (readyAt: number, now: number) =>
  now + Math.ceil(Math.max(0, readyAt - now) / 2);
