/** Smoothly join a moving path without teleporting when the fish changes mode. */
export const blendFishPosition = (from: number, target: number, elapsed: number, duration: number): number => {
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  const eased = progress * progress * (3 - 2 * progress);
  return from + (target - from) * eased;
};

/** Four-second wave; leave room for the entire sprite and a small bank margin. */
export const riverFishY = (riverTop: number, rowHeight: number, fishHeight: number, elapsed: number): number => {
  const amplitude = Math.max(0, (rowHeight - fishHeight) / 2 - rowHeight * 0.05);
  return riverTop + rowHeight / 2 + Math.sin(elapsed * Math.PI * 2 / 4000) * amplitude;
};
