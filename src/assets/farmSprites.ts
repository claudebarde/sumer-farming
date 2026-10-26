import donkeyUrl from "./sprite_assets/pngs/v2/isometric-test/donkey/donkey-idle-isometric.webp";
import millUrl from "./sprite_assets/pngs/v2/isometric-test/mill-isometric.webp";
import beerJarsUrl from "./sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-full-isometric.webp";
import breadBasketUrl from "./sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-basket-isometric.webp";
import fishUrl from "./sprite_assets/pngs/fish.webp";
import waterUrl from "./sprite_assets/pngs/water.webp";
import harvestedBarleyUrl from "./sprite_assets/pngs/wheat-sheaf.webp";
import farmerIdle0Url from "./sprite_assets/pngs/v2/farmer-idle-refined.webp";
import reedsUrl from "./sprite_assets/pngs/reeds-plant.webp";
import reedBundleUrl from "./sprite_assets/pngs/reed-bundle.webp";
import brickPileUrl from "./sprite_assets/pngs/brick-pile.webp";

// Keep gameplay names stable; only the artwork URLs change.
// The generated assets use "wheat" filenames for our existing barley artwork.
export const FARM_SPRITES = {
  donkey: donkeyUrl,
  beerJars: beerJarsUrl,
  breadBasket: breadBasketUrl,
  fish: fishUrl,
  water: waterUrl,
  harvestedBarley: harvestedBarleyUrl,
  farmerIdle0: farmerIdle0Url,
  reeds: reedsUrl,
  reedBundle: reedBundleUrl,
  brickPile: brickPileUrl,
  mill: millUrl,
} as const;

export type FarmSpriteName = keyof typeof FARM_SPRITES;

export const spriteName = <Name extends FarmSpriteName>(name: Name): Name =>
  name;
