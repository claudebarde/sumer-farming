import reach from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-harvest-dates-sickle-01.webp";
import cut from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-harvest-dates-sickle-02.webp";
import lower from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-harvest-dates-sickle-03.webp";
import release from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-harvest-dates-sickle-04.webp";

export const DATE_HARVEST_PREVIEW_SOURCES = { dateHarvestReach: reach, dateHarvestCut: cut, dateHarvestLower: lower, dateHarvestRelease: release } as const;
const sequence = ["dateHarvestReach", "dateHarvestCut", "dateHarvestLower", "dateHarvestRelease"] as const;
export const dateHarvestPreviewFrame = (elapsed: number, reduced = false) =>
  sequence[reduced ? 0 : Math.floor(Math.max(0, elapsed) / 450) % sequence.length]!;

// Appear halfway through the first stroke and remain for subsequent strokes.
export const dateHarvestPreviewBasketsVisible = (elapsed: number, reduced = false) => reduced || elapsed >= 900;

// Feet registration, in normalized source-canvas coordinates. Do not crop each
// frame around its raised sickle: that would change character size per stroke.
export const dateHarvestPreviewOrigin = () => ({ x: 0.54, y: 0.866 });
