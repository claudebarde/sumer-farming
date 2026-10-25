// Eight drawn poses, with slightly more time for lifting and setting the brick.
const phases = [
  { frame: 1, duration: 180 }, // bend
  { frame: 2, duration: 180 }, // grasp
  { frame: 3, duration: 220 }, // begin lifting
  { frame: 4, duration: 180 }, // chest-height lift
  { frame: 5, duration: 180 }, // reach
  { frame: 6, duration: 240 }, // place
  { frame: 7, duration: 140 }, // release
  { frame: 8, duration: 180 }, // lower hands, then bend again
] as const;
export const RENOVATION_BUILDER_CYCLE_MS = phases.reduce((sum, phase) => sum + phase.duration, 0);

export const renovationBuilderPose = (elapsed: number, reduced = false) => {
  if (reduced) return { frame: 0 };
  let time = Math.max(0, elapsed) % RENOVATION_BUILDER_CYCLE_MS;
  let index = 0;
  while (time >= phases[index]!.duration) { time -= phases[index]!.duration; index++; }
  return { frame: phases[index]!.frame };
};
