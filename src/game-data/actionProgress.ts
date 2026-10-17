/** Shared world/UI action-progress geometry, in logical pixels. */
export const ACTION_PROGRESS = { width: 52, height: 7, inset: 2, radius: 3, track: 0x513821, fill: 0xffd471 } as const;
export const actionProgressFraction = (fraction: number) => Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
