import { FARM_SPRITES } from "../../assets/farmSprites";
import granary from "../../assets/sprite_assets/pngs/v2/isometric-test/granary-isometric-test.webp";
import market from "../../assets/sprite_assets/pngs/v2/isometric-test/market-barley-isometric.webp";
import flour from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.webp";
import warehouse from "../../assets/sprite_assets/pngs/v2/isometric-test/warehouse-isometric.webp";
import palm from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/date-palm-isometric-empty.webp";
import oil from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/jar-oil-single.png";
import styles from "../styles/IsometricTest.module.scss";

const icons = [
  { name: "Barley", src: FARM_SPRITES.harvestedBarley },
  { name: "Granary", src: granary },
  { name: "Barley market", src: market },
  { name: "Fish", src: FARM_SPRITES.fish },
  { name: "Flour", src: flour },
  { name: "Bread", src: FARM_SPRITES.breadBasket },
  { name: "Donkey", src: FARM_SPRITES.donkey },
  { name: "Warehouse", src: warehouse },
  { name: "Date palm", src: palm },
  { name: "Oil", src: oil },
] as const;

/** Existing milestone artwork, selected from the saved estate level. */
export default function FarmLevelIcon({ level }: { readonly level: number }) {
  const icon = icons[level - 1] ?? icons[0];
  return <span className={`${styles.levelEmblem} ${styles.levelIcon}`} aria-hidden="true">
    <img src={icon.src} alt="" draggable={false} />
  </span>;
}
