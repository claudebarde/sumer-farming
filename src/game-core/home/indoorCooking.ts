import type { Cooking } from "../../game-data/kitchen";
import { distance } from "./interiorNavigation";

export const indoorCookingPose = (job: Cooking, now: number) => {
  if (!job.interior) return null;
  const { path, departedAt } = job.interior;
  const total = path.slice(1).reduce((sum, point, i) => sum + distance(path[i]!, point), 0);
  const fraction = Math.max(0, Math.min(1, (now - departedAt) / Math.max(1, Date.parse(job.startedAt) - departedAt)));
  let remaining = total * fraction;
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!, to = path[i]!, length = distance(from, to);
    if (remaining <= length || i === path.length - 1) {
      const t = length ? Math.min(1, remaining / length) : 1;
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t,
        facingLeft: to.x < from.x, walking: now < Date.parse(job.startedAt), distance: total * fraction };
    }
    remaining -= length;
  }
  return null;
};
