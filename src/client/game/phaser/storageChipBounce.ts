export type StorageChipState = { readonly quantity: number; readonly increasedAt: number | null };

export const updateStorageChip = (previous: StorageChipState | undefined, quantity: number, now: number): StorageChipState => ({
  quantity,
  increasedAt: previous && quantity > previous.quantity ? now
    : previous && quantity === previous.quantity ? previous.increasedAt : null,
});

/** A short lift and damped scale bounce, sampled by time so redraws cannot restart it. */
export const storageChipBounce = (increasedAt: number | null, now: number, reducedMotion = false) => {
  if (increasedAt === null || reducedMotion) return { scale: 1, offsetY: 0 };
  const progress = Math.max(0, Math.min(1, (now - increasedAt) / 420));
  if (progress === 0 || progress === 1) return { scale: 1, offsetY: 0 };
  return { scale: 1 + 0.2 * Math.sin(progress * Math.PI * 2) * (1 - progress), offsetY: -4 * Math.sin(progress * Math.PI) };
};
