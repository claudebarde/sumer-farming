import type { FarmSnapshot } from "../../../schemas/farm";
import type { HarvestGain } from "./isometricHarvesting";

/** Show newly confirmed, recent construction awards only; reloads establish a baseline. */
export const constructionGains = (before: FarmSnapshot, after: FarmSnapshot, now: number): readonly HarvestGain[] => {
  if (before.farm.id !== after.farm.id || !before.player.constructionAwards) return [];
  const previous = new Set(before.player.constructionAwards.map(award => award.source));
  return (after.player.constructionAwards ?? []).flatMap(award => {
    const completedAt = Date.parse(award.completedAt);
    if (previous.has(award.source) || award.points <= 0 || completedAt > now || now - completedAt > 10_000) return [];
    const building = after.buildings.find(b => `building:${b.type}` === award.source && b.completesAt === award.completedAt);
    if (!building || !before.buildings.some(b => b.id === building.id)) return [];
    return [{ cell: { column: building.column, row: building.row }, at: now, quantity: award.points, offsetY: -100 }];
  });
};
