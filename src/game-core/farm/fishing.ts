import { FISH_CATCH_RADIUS } from "../../game-data/fishing";

const randomAt = (seed: number, index: number) => {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
};

/** Seeded, smooth movement shared by the renderer and authoritative catch check. */
export const fishPosition = (seed: number, elapsed: number): number => {
  const time = Math.max(0, elapsed) / 1600;
  const segment = Math.floor(time);
  const fraction = time - segment;
  const from = 0.1 + 0.8 * randomAt(seed, segment);
  const to = 0.1 + 0.8 * randomAt(seed, segment + 1);
  // Brief pauses and smooth turns, without teleporting on segment boundaries.
  const progress = Math.min(1, Math.max(0, (fraction - 0.12) / 0.8));
  return from + (to - from) * (progress * progress * (3 - 2 * progress));
};

export const catchesFish = (seed: number, elapsed: number, aim: number) =>
  Number.isFinite(aim) && aim >= 0 && aim <= 1 &&
  Math.abs(fishPosition(seed, elapsed) - aim) <= FISH_CATCH_RADIUS;
