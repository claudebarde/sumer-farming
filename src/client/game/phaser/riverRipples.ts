/** Sparse, gently drifting strokes; all coordinates stay inside a 96×48 diamond. */
export const riverRipples = (column: number, elapsed: number, reducedMotion = false) =>
  [0, 1].map(index => {
    const seed = Math.abs(column * 17 + index * 31);
    const period = (8000 + seed % 4 * 900) / 1.5;
    const phase = ((reducedMotion ? 0 : elapsed) / period + (seed % 19) / 19) % 1;
    const envelope = Math.sin(Math.PI * phase) ** 2;
    // The previous oscillation covered 16px per cycle. Keep that distance, now
    // entirely left-to-right, with a 1.5× time rate. Fade out before recycling.
    const x = (index === 0 ? -6 : 6) + (phase - 0.5) * 16;
    const edge = Math.min(1, phase / 0.12, (1 - phase) / 0.12);
    const fade = edge * edge * (3 - 2 * edge);
    const y = (index === 0 ? -5 : 5) + (seed % 3 - 1);
    const halfWidth = 7 + seed % 4;
    return {
      alpha: reducedMotion ? 0.4 : (0.28 + 0.42 * envelope) * fade,
      points: Array.from({ length: 9 }, (_, step) => {
        const t = step / 8;
        return { x: x + (t * 2 - 1) * halfWidth, y: y + Math.sin(t * Math.PI * 2) * 1.1 };
      }),
    };
  });
