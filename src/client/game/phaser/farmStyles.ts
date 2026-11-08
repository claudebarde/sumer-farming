import natural from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-isometric-historical.png";
import pale from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-finish-pale-plaster.png";
import reeds from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-finish-reeds.png";
import clay from "../../../assets/sprite_assets/pngs/v2/isometric-test/farm-finish-red-clay.png";

export const FARM_STYLES = [
  { key: "farm-level-9", label: "Natural earth", source: natural },
  { key: "farm-style-pale", label: "Pale plaster", source: pale },
  { key: "farm-style-reeds", label: "Reed house", source: reeds },
  { key: "farm-style-clay", label: "Red clay", source: clay }
] as const;
export type FarmStyleKey = typeof FARM_STYLES[number]["key"];
export const FARM_STYLE_SOURCES = Object.fromEntries(FARM_STYLES.slice(1).map(style => [style.key, style.source]));
