import harvest01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-harvest-01.png";
import harvest02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-harvest-02.png";
import harvest03 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-harvest-03.png";

export const FARMER_HARVEST_SOURCES = [harvest01, harvest02, harvest03] as const;
// Equal-size windows preserve proportions while aligning the feet across generated poses.
// Never fit each pose independently: bending must not enlarge the character.
export const FARMER_HARVEST_BOUNDS = [
  { left: 44, top: 24, right: 467, bottom: 447 },
  { left: 12, top: 24, right: 435, bottom: 447 },
  { left: 60, top: 24, right: 483, bottom: 447 },
] as const;
const HARVEST_CYCLE = [0, 1, 2, 1] as const;
export const farmerHarvestTexture = (elapsed: number) =>
  `farmer-harvest-iso-${HARVEST_CYCLE[Math.floor(Math.max(0, elapsed) / 550) % HARVEST_CYCLE.length]}`;
