import level1 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-level-01.webp";
import level3 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-level-03.webp";
import level4 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-level-04.webp";
import level9 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-level-09.webp";

export const FARM_EVOLUTION_SOURCES = { "farm-level-1": level1, "farm-level-3": level3, "farm-level-4": level4, "farm-level-9": level9 } as const;
/** Cosmetic stages only; building geometry and gameplay remain unchanged. */
export const farmAppearance = (level = 1) => level >= 9
  ? { texture: "farm-level-9", storageChipY: -150 }
  : level >= 4 ? { texture: "farm-level-4", storageChipY: -137 }
  : level >= 3 ? { texture: "farm-level-3", storageChipY: -137 }
    : { texture: "farm-level-1", storageChipY: -83 };
