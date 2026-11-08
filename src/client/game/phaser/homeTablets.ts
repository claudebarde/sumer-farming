import beer from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-decorations/beer-clay-tablet-wall.png";
import cook from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-decorations/cook-clay-tablet-wall.png";
import barley from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-decorations/barley-clay-tablet-wall-test.png";
import sky from "../../../assets/sprite_assets/pngs/v2/isometric-test/home-decorations/sky-clay-tablet-wall-test.png";
import { prepareBuildingTexture } from "./buildingTexture";
import { FARMER_SHARPEN_AMOUNT } from "./farmerTexture";

export const HOME_TABLETS = [
  { key: "home-tablet-barley", label: "Barley", source: barley },
  { key: "home-tablet-sky", label: "Sky", source: sky },
  { key: "home-tablet-beer", label: "Beer", source: beer },
  { key: "home-tablet-cook", label: "Cook", source: cook }
] as const;
export type HomeTabletKey = "none" | typeof HOME_TABLETS[number]["key"];
export const HOME_TABLET_SOURCES = Object.fromEntries(HOME_TABLETS.map(item => [item.key, item.source]));

/** All tablet sprites contain their wall perspective; do not skew their artwork again. */
export const prepareWallTabletTexture = (source: HTMLImageElement): HTMLCanvasElement =>
  prepareBuildingTexture(source, { maxSize: 128, sharpen: FARMER_SHARPEN_AMOUNT });

/** Shared farmhouse-wall anchor in both farm and neighbourhood scenes. */
export const HOME_TABLET_PLACEMENT = { x: 36, y: -99, width: 46.8, depth: 0.2 } as const;
