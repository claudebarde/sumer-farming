import { CheckIcon, Cross2Icon, ReloadIcon, ArrowLeftIcon, ArrowRightIcon } from "@radix-ui/react-icons";
import shekels from "../../assets/sprite_assets/pngs/shekels.webp";
import flour from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.webp";
import groats from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.webp";
import brewBeer from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewing-beer-icon.webp";
import pickaxe from "../../assets/sprite_assets/pngs/v2/isometric-test/farmer-building-pickaxe.png";
import emptyJars from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-empty-isometric.webp";
import bread from "../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-basket-isometric.webp";
import donkey from "../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-idle-isometric.webp";
import styles from "../styles/BuildingActionButton.module.scss";
import plantBarley from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/optimized/plant-barley-icon.png";
import harvestBarley from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/optimized/harvest-barley-icon.png";
import walk from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/optimized/walk-here-icon.png";
import manage from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/optimized/manage-clay-tablet.png";
import settings from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/optimized/settings-ruler-stylus.png";
import neighbourhood from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/optimized/neighbourhood-icon.png";
import leaderboard from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/optimized/leaderboard-icon.png";
import upgrade from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/optimized/upgrade-building-icon.png";
import irrigation from "../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-ne-sw.png";
import road from "../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-ne-sw.png";
import { FARM_SPRITES } from "../../assets/farmSprites";

const actionImages = { shekels, settings, upgrade, water: FARM_SPRITES.water, beer: FARM_SPRITES.beerJars, barley: FARM_SPRITES.harvestedBarley, leaderboard, neighbourhood, manage, flour, groats, brewBeer, emptyJars, bread, donkey, destroy: pickaxe, plantBarley, harvestBarley, walk, irrigation, road, fish: FARM_SPRITES.fish, reed: FARM_SPRITES.reedBundle, clay: FARM_SPRITES.brickPile } as const;

const actionSymbols = { confirm: CheckIcon, cancel: Cross2Icon, refresh: ReloadIcon, previous: ArrowLeftIcon, next: ArrowRightIcon } as const;
type ActionIconKind = keyof typeof actionImages | keyof typeof actionSymbols;
const isSymbol = (kind: ActionIconKind): kind is keyof typeof actionSymbols => kind in actionSymbols;

export default function BuildingActionIcon({ kind, className = "" }: { kind: ActionIconKind; className?: string }) {
  if (isSymbol(kind)) {
    const Symbol = actionSymbols[kind];
    return <span className={`${styles.icon} ${styles.symbol} ${className}`} aria-hidden="true"><Symbol /></span>;
  }
  return <span className={`${styles.icon} ${kind === "destroy" ? styles.crossed : ""} ${className}`} aria-hidden="true">
    <img src={actionImages[kind]} alt="" draggable={false} />
    {kind === "destroy" && <img className={styles.flipped} src={pickaxe} alt="" draggable={false} />}
  </span>;
}
