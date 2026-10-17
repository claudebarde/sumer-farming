import flour from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.png";
import groats from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.png";
import pickaxe from "../../assets/sprite_assets/pngs/v2/isometric-test/farmer-building-pickaxe.png";
import emptyJars from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/beer-jars-empty-isometric.png";
import bread from "../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-basket-isometric.png";
import styles from "../styles/BuildingActionButton.module.scss";
import plantBarley from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/plant-barley-icon.png";
import walk from "../../assets/sprite_assets/pngs/v2/isometric-test/icons/walk-here-icon.png";
import irrigation from "../../assets/sprite_assets/pngs/v2/isometric-test/canals/canal-ne-sw.png";
import road from "../../assets/sprite_assets/pngs/v2/isometric-test/roads/road-ne-sw.png";
import { FARM_SPRITES } from "../../assets/farmSprites";

const actionImages = { flour, groats, emptyJars, bread, destroy: pickaxe, plantBarley, walk, irrigation, road, fish: FARM_SPRITES.fish, reed: FARM_SPRITES.reedBundle } as const;

export default function BuildingActionIcon({ kind }: { kind: keyof typeof actionImages }) {
  return <span className={`${styles.icon} ${kind === "destroy" ? styles.crossed : ""}`} aria-hidden="true">
    <img src={actionImages[kind]} alt="" draggable={false} />
    {kind === "destroy" && <img className={styles.flipped} src={pickaxe} alt="" draggable={false} />}
  </span>;
}
