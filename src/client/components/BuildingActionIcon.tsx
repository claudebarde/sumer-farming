import flour from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.png";
import groats from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.png";
import brewBeer from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewing-beer-icon.png";
import pickaxe from "../../assets/sprite_assets/pngs/v2/isometric-test/farmer-building-pickaxe.png";
import emptyJars from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-empty-isometric.png";
import bread from "../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-basket-isometric.png";
import donkey from "../../assets/sprite_assets/pngs/v2/isometric-test/donkey/donkey-idle-isometric.png";
import styles from "../styles/BuildingActionButton.module.scss";
import plantBarley from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/plant-barley-icon.png";
import harvestBarley from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/harvest-barley-icon.png";
import walk from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/walk-here-icon.png";
import manage from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/manage-clay-tablet.png";
import settings from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/settings-ruler-stylus.png";
import neighbourhood from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/neighbourhood-icon.png";
import leaderboard from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/leaderboard-icon.png";
import upgrade from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/upgrade-building-icon.png";
import irrigation from "../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-ne-sw.png";
import road from "../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-ne-sw.png";
import { FARM_SPRITES } from "../../assets/farmSprites";

const actionImages = { settings, upgrade, water: FARM_SPRITES.water, leaderboard, neighbourhood, manage, flour, groats, brewBeer, emptyJars, bread, donkey, destroy: pickaxe, plantBarley, harvestBarley, walk, irrigation, road, fish: FARM_SPRITES.fish, reed: FARM_SPRITES.reedBundle, clay: FARM_SPRITES.brickPile } as const;

export default function BuildingActionIcon({ kind, className = "" }: { kind: keyof typeof actionImages; className?: string }) {
  return <span className={`${styles.icon} ${kind === "destroy" ? styles.crossed : ""} ${className}`} aria-hidden="true">
    <img src={actionImages[kind]} alt="" draggable={false} />
    {kind === "water" && <span className={`cuneiforms ${styles.waterSign}`}>𒀀</span>}
    {kind === "destroy" && <img className={styles.flipped} src={pickaxe} alt="" draggable={false} />}
  </span>;
}
