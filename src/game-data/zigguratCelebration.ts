export const ZIGGURAT_CELEBRATION_MS = 25000;
const corners = [{ column: -6, row: 2 }, { column: -6, row: -4 }, { column: 1, row: -4 }, { column: 1, row: 2 }] as const;
export const zigguratCelebrationRoadLoop = corners.flatMap((from, i) => {
  const to = corners[(i + 1) % corners.length]!;
  const length = Math.abs(to.column - from.column) + Math.abs(to.row - from.row);
  return Array.from({ length }, (_, step) => ({ column: from.column + Math.sign(to.column - from.column) * step,
    row: from.row + Math.sign(to.row - from.row) * step }));
});
export const zigguratCelebrationPose = (elapsed: number, index: number) => {
  const loop = zigguratCelebrationRoadLoop;
  const steps = ((elapsed / 850 - index * 1.15) % loop.length + loop.length) % loop.length;
  const from = loop[Math.floor(steps)]!, to = loop[(Math.floor(steps) + 1) % loop.length]!, fraction = steps % 1;
  return { from, to, position: { column: from.column + (to.column - from.column) * fraction,
    row: from.row + (to.row - from.row) * fraction },
    alpha: Math.max(0, Math.min(1, elapsed / 1000, (ZIGGURAT_CELEBRATION_MS - elapsed) / 1000)) };
};
