import type { FarmSnapshot } from "../../../schemas/farm";
import { CROP_DEFINITIONS } from "../../../game-data/crops";
import type { PalmCycle } from "../../../game-data/datePalmCycle";
import { cropSprite } from "./cropPresentation";
import sapling from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-sapling.png";
import empty from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-empty.png";
import flowering from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-flowering.png";
import ripe from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-ripe.png";

export const DATE_PALM_SOURCES = {
  datePalmSapling: sapling, datePalmGrowing: empty,
  datePalmFlowering: flowering, datePalmReady: ripe
} as const;

// Shared source framing keeps the sapling smaller and roots at the same anchor.
export const DATE_PALM_BOUNDS = { left: 0, top: 0, right: 1023, bottom: 923 } as const;
// Prepared textures place the trunk base at y=120, not at the ground-item anchor.
export const DATE_PALM_ORIGIN = { x: 0.5, y: 120 / 128 } as const;
// Retain fine leaf/fruit detail at normal zoom without hardening alpha edges.
export const DATE_PALM_TEXTURE_SIZE = 256;
export const DATE_PALM_SHARPEN_AMOUNT = 0.25;

/** Cosmetic stages only. Saved deadlines remain authoritative for harvests.
 * Care doubles subsequent progress without jumping backwards or restarting it.
 */
export const isometricCropSprite = (crop: FarmSnapshot["crops"][number], now: number, cycle?: PalmCycle) => {
  if (crop.cropKey !== "datePalm") return cropSprite(crop, now);
  const plantedAt = Date.parse(crop.plantedAt);
  if (now < plantedAt) return null;
  if (crop.harvestCompletesAt && now >= Date.parse(crop.harvestCompletesAt)) return "datePalmGrowing";
  const readyAt = Date.parse(crop.growthCompletesAt);
  if (now >= readyAt) return "datePalmReady";
  const maturity = CROP_DEFINITIONS.datePalm.growthDurationMs;
  if (now < plantedAt + maturity) {
    const elapsed = now - plantedAt;
    return elapsed < maturity / 2 ? "datePalmSapling"
      : elapsed < maturity * 3 / 4 ? "datePalmGrowing" : "datePalmFlowering";
  }
  // Legacy cycles had a twelve-hour duration; preserve their saved deadline.
  const start = cycle?.startedAt ?? Math.max(plantedAt + maturity, readyAt - 12 * 3600000);
  const duration = cycle ? cycle.originalReadyAt - start : readyAt - start;
  const elapsed = now - start + (cycle?.tendedAt === undefined ? 0 : Math.max(0, now - cycle.tendedAt));
  return elapsed < duration / 2 ? "datePalmGrowing" : "datePalmFlowering";
};
