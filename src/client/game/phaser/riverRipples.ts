export const riverRippleDefinitions = (column: number) => [0, 1].map(index => {
  const seed = Math.abs(column * 17 + index * 31);
  return {
    period: (8000 + seed % 4 * 900) / 1.5,
    phaseOffset: (seed % 19) / 19,
    x: index === 0 ? -6 : 6,
    y: (index === 0 ? -5 : 5) + (seed % 3 - 1),
    halfWidth: 7 + seed % 4,
  };
});
type RippleDefinition = ReturnType<typeof riverRippleDefinitions>[number];

export const riverRipplePose = (ripple: RippleDefinition, elapsed: number, reducedMotion = false) => {
  const phase = ((reducedMotion ? 0 : elapsed) / ripple.period + ripple.phaseOffset) % 1;
  const edge = Math.min(1, phase / 0.12, (1 - phase) / 0.12);
  const fade = edge * edge * (3 - 2 * edge);
  return {
    x: ripple.x + (phase - 0.5) * 16,
    y: ripple.y,
    alpha: reducedMotion ? 0.4 : (0.28 + 0.42 * Math.sin(Math.PI * phase) ** 2) * fade,
  };
};

export const riverRippleShape = (halfWidth: number) => Array.from({ length: 9 }, (_, step) => {
  const t = step / 8;
  return { x: (t * 2 - 1) * halfWidth, y: Math.sin(t * Math.PI * 2) * 1.1 };
});

/** Full geometry for bounds checks; the renderer caches these shapes instead. */
export const riverRipples = (column: number, elapsed: number, reducedMotion = false) =>
  riverRippleDefinitions(column).map(ripple => {
    const pose = riverRipplePose(ripple, elapsed, reducedMotion);
    return { alpha: pose.alpha, points: riverRippleShape(ripple.halfWidth).map(point => ({ x: pose.x + point.x, y: pose.y + point.y })) };
  });
