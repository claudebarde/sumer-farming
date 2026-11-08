import historical from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-historical.png";
import lowWalls from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-historical-level-01.png";
import roofed from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-historical-level-03.png";
import awning from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-historical-level-04.png";

export const FARM_EVOLUTION_SOURCES = { "farm-level-1": lowWalls, "farm-level-3": roofed, "farm-level-4": awning, "farm-level-9": historical } as const;
/** Shared cosmetic stages for the farm, market and neighbourhood. */
export const farmAppearance = (level = 1) => level >= 9
  ? { texture: "farm-level-9", storageChipY: -150 }
  : level >= 4 ? { texture: "farm-level-4", storageChipY: -150 }
  : level >= 3 ? { texture: "farm-level-3", storageChipY: -150 }
    : { texture: "farm-level-1", storageChipY: -60 };
