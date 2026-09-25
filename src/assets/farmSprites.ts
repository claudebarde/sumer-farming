import groundUrl from "./sprite_assets/pngs/ground.png";
import fishingUrl from "./sprite_assets/pngs/farmer-fishing.png";
import withFishUrl from "./sprite_assets/pngs/farmer-with-fish.png";
import fishUrl from "./sprite_assets/pngs/fish.png";
import groundVariantUrl from "./sprite_assets/pngs/ground-grass.png";
import canalHorizontalUrl from "./sprite_assets/pngs/canal-horizontal.png";
import canalVerticalUrl from "./sprite_assets/pngs/canal-vertical.png";
import canalCornerUrl from "./sprite_assets/pngs/canal-corner.png";
import canalCrossUrl from "./sprite_assets/pngs/canal-intersection-a.png";
import canalTJunctionUrl from "./sprite_assets/pngs/canal-intersection-b.png";
import waterUrl from "./sprite_assets/pngs/water.png";
import groundPathHorizontalUrl from "./sprite_assets/pngs/mud-road-horizontal.png";
import groundFenceUrl from "./sprite_assets/pngs/ground-fence-tile.png";
import barleySeededUrl from "./sprite_assets/pngs/field-plowed.png";
import barleyGrowingUrl from "./sprite_assets/pngs/field-seeded.png";
import barleyReadyUrl from "./sprite_assets/pngs/field-wheat-ripe.png";
import harvestedBarleyUrl from "./sprite_assets/pngs/wheat-sheaf.png";
import farmerIdle0Url from "./sprite_assets/pngs/farmer-stand-staff-1.png";
import farmerIdle1Url from "./sprite_assets/pngs/farmer-stand-staff-2.png";
import farmerIdle2Url from "./sprite_assets/pngs/farmer-stand-staff-3.png";
import farmerIdle3Url from "./sprite_assets/pngs/farmer-stand-staff-4.png";
import farmerIdle4Url from "./sprite_assets/pngs/farmer-stand-staff-5.png";
import farmerIdle5Url from "./sprite_assets/pngs/farmer-stand-staff-6.png";
import farmerWalk0Url from "./sprite_assets/pngs/farmer-walk-1.png";
import farmerWalk1Url from "./sprite_assets/pngs/farmer-walk-2.png";
import farmerWalk2Url from "./sprite_assets/pngs/farmer-walk-3.png";
import farmerWalk3Url from "./sprite_assets/pngs/farmer-walk-4.png";
import farmerPlant0Url from "./sprite_assets/pngs/farmer-plant-1.png";
import farmerPlant1Url from "./sprite_assets/pngs/farmer-plant-2.png";
import farmerPlant2Url from "./sprite_assets/pngs/farmer-plant-3.png";
import farmerPlant3Url from "./sprite_assets/pngs/farmer-plant-4.png";
import farmerHarvest0Url from "./sprite_assets/pngs/farmer-harvest-1.png";
import farmerHarvest1Url from "./sprite_assets/pngs/farmer-harvest-2.png";
import farmerHarvest2Url from "./sprite_assets/pngs/farmer-carry-wheat-1.png";
import farmerHarvest3Url from "./sprite_assets/pngs/farmer-carry-wheat-2.png";
import farmUrl from "./sprite_assets/pngs/farm.png";
import palmTreeUrl from "./sprite_assets/pngs/palm-tree.png";
import bushUrl from "./sprite_assets/pngs/bush.png";
import reedsUrl from "./sprite_assets/pngs/reeds-plant.png";
import rocksUrl from "./sprite_assets/pngs/rocks.png";
import fenceUrl from "./sprite_assets/pngs/fence.png";
import signpostUrl from "./sprite_assets/pngs/signpost.png";
import marketUrl from "./sprite_assets/pngs/market.png";
import granaryUrl from "./sprite_assets/pngs/granary.png";
import reedBundleUrl from "./sprite_assets/pngs/reed-bundle.png";
import brickPileUrl from "./sprite_assets/pngs/brick-pile.png";
import breweryUrl from "./sprite_assets/pngs/brewery.png";

// Keep gameplay names stable; only the artwork URLs change.
// The generated assets use "wheat" filenames for our existing barley artwork.
export const FARM_SPRITES = {
  farmerFishing: fishingUrl,
  farmerWithFish: withFishUrl,
  fish: fishUrl,
  ground: groundUrl,
  groundVariant: groundVariantUrl,
  canalHorizontal: canalHorizontalUrl,
  canalVertical: canalVerticalUrl,
  canalCorner: canalCornerUrl,
  canalCross: canalCrossUrl,
  canalTJunction: canalTJunctionUrl,
  water: waterUrl,
  groundPathHorizontal: groundPathHorizontalUrl,
  groundFence: groundFenceUrl,
  barleySeeded: barleySeededUrl,
  barleyGrowing: barleyGrowingUrl,
  barleyReady: barleyReadyUrl,
  harvestedBarley: harvestedBarleyUrl,
  farmerIdle0: farmerIdle0Url,
  farmerIdle1: farmerIdle1Url,
  farmerIdle2: farmerIdle2Url,
  farmerIdle3: farmerIdle3Url,
  farmerIdle4: farmerIdle4Url,
  farmerIdle5: farmerIdle5Url,
  farmerWalk0: farmerWalk0Url,
  farmerWalk1: farmerWalk1Url,
  farmerWalk2: farmerWalk2Url,
  farmerWalk3: farmerWalk3Url,
  farmerPlant0: farmerPlant0Url,
  farmerPlant1: farmerPlant1Url,
  farmerPlant2: farmerPlant2Url,
  farmerPlant3: farmerPlant3Url,
  farmerHarvest0: farmerHarvest0Url,
  farmerHarvest1: farmerHarvest1Url,
  farmerHarvest2: farmerHarvest2Url,
  farmerHarvest3: farmerHarvest3Url,
  farm: farmUrl,
  palmTree: palmTreeUrl,
  bush: bushUrl,
  reeds: reedsUrl,
  rocks: rocksUrl,
  fence: fenceUrl,
  signpost: signpostUrl,
  market: marketUrl,
  granary: granaryUrl,
  reedBundle: reedBundleUrl,
  brickPile: brickPileUrl,
  brewery: breweryUrl
} as const;

export type FarmSpriteName = keyof typeof FARM_SPRITES;

export const spriteName = <Name extends FarmSpriteName>(name: Name): Name =>
  name;
