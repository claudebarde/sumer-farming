import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";

export const LYRE_SOURCES = Object.entries(import.meta.glob([
  "../../../assets/sprite_assets/pngs/v2/isometric-test/lyre-musician-walk-*.webp",
  "../../../assets/sprite_assets/pngs/v2/isometric-test/lyre-musician-female-walk-*.webp",
], {
  eager: true, query: "?url", import: "default",
})).sort(([a], [b]) => a.localeCompare(b)).map(([path, url]) => ({
  key: `lyre-${path.includes("-female-") ? "female" : "male"}-walk-${Number(path.match(/walk-(\d+)\.webp$/)![1]) - 1}`,
  url: url as string,
}));
export const PROCESSION_COUNT = 5;
const spacing = 1.15;
const start = config.worldBounds.minimumColumn - 1;
const end = config.worldBounds.maximumColumn + 1;
const tileMs = 850;
export const PROCESSION_DURATION_MS = (end - start + (PROCESSION_COUNT - 1) * spacing) * tileMs;
export const processionPose = (elapsed: number, index: number) => {
  const column = start + Math.max(0, elapsed) / tileMs - index * spacing;
  return {
    cell: { column, row: config.roadRow },
    visible: elapsed >= 0 && column >= config.worldBounds.minimumColumn - 0.5 && column <= config.worldBounds.maximumColumn + 0.5,
    // Index zero leads the procession; even numbered positions use the female set.
    texture: `lyre-${index % 2 === 0 ? "male" : "female"}-walk-${Math.floor(Math.max(0, elapsed) / 180 + index) % 4}`,
  };
};
