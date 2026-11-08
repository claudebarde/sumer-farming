import pottery from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-decorations/pottery-review.png";
import baskets from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-decorations/baskets-review.png";
import stool from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-decorations/stool-review.png";
import mat from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-decorations/rolled-mat-review.png";

// Front-wall placements: pottery left of the door; other items between the
// right doorpost and the front corner, rather than along the ladder-side wall.
export const HOME_DECORATIONS = [
  { key: "home-pottery", label: "Pottery", source: pottery, width: 56, offsetX: -76, offsetY: -30 },
  { key: "home-baskets", label: "Baskets", source: baskets, width: 56, offsetX: -20, offsetY: -8 },
  { key: "home-stool", label: "Stool", source: stool, width: 50, offsetX: -20, offsetY: -8 },
  { key: "home-mat", label: "Reed mat", source: mat, width: 40, offsetX: -20, offsetY: -8 }
] as const;
export type HomeDecorationKey = "none" | typeof HOME_DECORATIONS[number]["key"];
export const HOME_DECORATION_SOURCES = Object.fromEntries(HOME_DECORATIONS.map(item => [item.key, item.source]));
